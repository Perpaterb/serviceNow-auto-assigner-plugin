// Auto-Assigner engine.
//
// Runs every N minutes via a scheduled job. Iterates over every assigner
// where running=true, in series, applying the cycle defined in
// ARCHITECTURE.md: gate by time window, reconcile roster, build the
// eligible analyst list, distribute unassigned tickets round-robin,
// then (if enabled) unassign responded tickets from not-working analysts.
//
// Scope: x_1578378_aa
(function execute() {
    var SCOPE = 'x_1578378_aa_';
    var TAG = '[' + SCOPE + 'engine]';

    var assigner = new GlideRecord(SCOPE + 'assigner');
    assigner.addQuery('running', true);
    assigner.query();
    var processed = 0;
    while (assigner.next()) {
        try {
            processAssigner(assigner.getUniqueValue());
            processed++;
        } catch (e) {
            gs.error(TAG + ' error processing assigner ' + assigner.name + ' (' + assigner.getUniqueValue() + '): ' + e);
        }
    }
    if (processed > 0) gs.info(TAG + ' processed ' + processed + ' assigner(s)');

    function processAssigner(assignerSysId) {
        var a = new GlideRecord(SCOPE + 'assigner');
        if (!a.get(assignerSysId)) return;

        var now = new GlideDateTime();
        var nowSec = secondsOfDay(now);

        // 1. Time-window gate
        var startSec = timeFieldToSeconds(a.getValue('run_start_time'));
        if (startSec !== null && nowSec < startSec) return;
        if (a.stop_overnight == true) {
            var endSec = timeFieldToSeconds(a.getValue('run_end_time'));
            if (endSec !== null && nowSec > endSec) return;
        }

        var groupSysId = a.getValue('assignment_group');
        if (!groupSysId) {
            gs.warn(TAG + ' assigner ' + a.name + ' has no assignment_group; skipping');
            return;
        }

        // 2. Reconcile roster against current group membership
        reconcileRoster(assignerSysId, groupSysId);

        // 3. Build eligible list (active, working, on-shift, not on break)
        var eligible = buildEligible(assignerSysId, nowSec);

        // 4 + 5. Distribute unassigned tickets round-robin
        if (eligible.length > 0) {
            var tickets = collectUnassignedTickets(assignerSysId, groupSysId);
            distribute(assignerSysId, eligible, tickets, now);
        }

        // 6. Reassign responded tickets from not-working analysts AFTER distribution
        // (freed tickets are picked up by the next cycle per R7.2 / Q5b)
        if (a.reassign_responded == true) {
            reassignResponded(assignerSysId, groupSysId, a);
        }

        a.last_run = now;
        a.update();
    }

    // --- helpers --------------------------------------------------------------

    function secondsOfDay(gdt) {
        // Instance TZ (system display TZ). Format: "yyyy-MM-dd HH:mm:ss".
        var display = gdt.getDisplayValue();
        var hhmmss = display.substring(11);
        var p = hhmmss.split(':');
        return parseInt(p[0], 10) * 3600 + parseInt(p[1], 10) * 60 + parseInt(p[2], 10);
    }

    function timeFieldToSeconds(timeStr) {
        if (!timeStr) return null;
        // glide_time stored as "1970-01-01 HH:MM:SS"
        var m = ('' + timeStr).match(/(\d{2}):(\d{2}):(\d{2})$/);
        if (!m) return null;
        return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    }

    function reconcileRoster(assignerSysId, groupSysId) {
        var members = new GlideRecord('sys_user_grmember');
        members.addQuery('group', groupSysId);
        members.query();
        var memberSet = {};
        while (members.next()) {
            var userSysId = members.getValue('user');
            memberSet[userSysId] = true;

            var existing = new GlideRecord(SCOPE + 'roster_entry');
            existing.addQuery('assigner', assignerSysId);
            existing.addQuery('analyst', userSysId);
            existing.query();
            if (existing.next()) {
                if (existing.active != true) {
                    existing.active = true;
                    existing.update();
                }
            } else {
                var roster = new GlideRecord(SCOPE + 'roster_entry');
                roster.initialize();
                roster.assigner = assignerSysId;
                roster.analyst = userSysId;
                roster.active = true;
                roster.working = false;
                roster.insert();
            }
        }

        // Soft-deactivate roster entries for ex-members
        var rosters = new GlideRecord(SCOPE + 'roster_entry');
        rosters.addQuery('assigner', assignerSysId);
        rosters.addQuery('active', true);
        rosters.query();
        while (rosters.next()) {
            var analystSysId = rosters.getValue('analyst');
            if (!memberSet[analystSysId]) {
                rosters.active = false;
                rosters.update();
            }
        }
    }

    function buildEligible(assignerSysId, nowSec) {
        var eligible = [];
        var rosters = new GlideRecord(SCOPE + 'roster_entry');
        rosters.addQuery('assigner', assignerSysId);
        rosters.addQuery('active', true);
        rosters.addQuery('working', true);
        rosters.addNotNullQuery('shift');
        rosters.orderBy('last_assigned_at'); // nulls first by default
        rosters.orderBy('sys_id');
        rosters.query();
        while (rosters.next()) {
            var shiftSysId = rosters.getValue('shift');
            var shift = new GlideRecord(SCOPE + 'shift');
            if (!shift.get(shiftSysId)) continue;
            var startSec = timeFieldToSeconds(shift.getValue('start_time'));
            var endSec = timeFieldToSeconds(shift.getValue('end_time'));
            if (startSec === null || endSec === null) continue;
            if (nowSec < startSec || nowSec > endSec) continue;
            if (isOnBreak(shiftSysId, nowSec)) continue;

            eligible.push({
                rosterSysId: rosters.getUniqueValue(),
                analystSysId: rosters.getValue('analyst'),
                shiftSysId: shiftSysId
            });
        }
        return eligible;
    }

    function isOnBreak(shiftSysId, nowSec) {
        var breaks = new GlideRecord(SCOPE + 'shift_break');
        breaks.addQuery('shift', shiftSysId);
        breaks.query();
        while (breaks.next()) {
            var s = timeFieldToSeconds(breaks.getValue('start_time'));
            var e = timeFieldToSeconds(breaks.getValue('end_time'));
            if (s === null || e === null) continue;
            if (nowSec >= s && nowSec <= e) return true;
        }
        return false;
    }

    function collectUnassignedTickets(assignerSysId, groupSysId) {
        var types = new GlideRecord(SCOPE + 'ticket_type_selection');
        types.addQuery('assigner', assignerSysId);
        types.addQuery('enabled', true);
        types.query();
        var all = [];
        while (types.next()) {
            var tableName = types.getValue('table_name');
            if (!tableName) continue;
            try {
                var t = new GlideRecord(tableName);
                t.addQuery('assignment_group', groupSysId);
                t.addNullQuery('assigned_to');
                t.orderBy('sys_created_on');
                t.query();
                while (t.next()) {
                    all.push({
                        tableName: tableName,
                        sysId: t.getUniqueValue(),
                        createdOn: t.getValue('sys_created_on')
                    });
                }
            } catch (e) {
                gs.warn(TAG + ' could not query table ' + tableName + ': ' + e);
            }
        }
        // Global oldest-first across all enabled types (R9.6)
        all.sort(function (a, b) {
            return ('' + a.createdOn).localeCompare('' + b.createdOn);
        });
        return all;
    }

    function distribute(assignerSysId, eligible, tickets, now) {
        for (var i = 0; i < tickets.length; i++) {
            if (eligible.length === 0) break;
            var pick = eligible.shift();

            var tr = new GlideRecord(tickets[i].tableName);
            if (!tr.get(tickets[i].sysId)) continue;
            tr.assigned_to = pick.analystSysId; // R9.8 — only assigned_to
            tr.update();

            var rr = new GlideRecord(SCOPE + 'roster_entry');
            if (rr.get(pick.rosterSysId)) {
                rr.last_assigned_at = now;
                rr.last_shift = pick.shiftSysId;
                rr.update();
            }

            logActivity(assignerSysId, tickets[i].tableName, tr.getValue('number'),
                        tr.getUniqueValue(), 'assigned', pick.analystSysId);

            // Round-robin: just-assigned analyst goes to the back of the line.
            eligible.push(pick);
        }
    }

    function reassignResponded(assignerSysId, groupSysId, a) {
        // Build set of not-working analysts on this assigner
        var notWorking = {};
        var rr = new GlideRecord(SCOPE + 'roster_entry');
        rr.addQuery('assigner', assignerSysId);
        rr.addQuery('working', false);
        rr.query();
        while (rr.next()) {
            notWorking[rr.getValue('analyst')] = true;
        }

        var inProgress = a.reassign_state_in_progress == true;
        var newSt      = a.reassign_state_new == true;
        var ohToIp     = a.reassign_state_onhold_to_inprogress == true;
        if (!inProgress && !newSt && !ohToIp) return;

        var types = new GlideRecord(SCOPE + 'reassign_type_selection');
        types.addQuery('assigner', assignerSysId);
        types.addQuery('enabled', true);
        types.query();
        while (types.next()) {
            var tableName = types.getValue('table_name');
            if (!tableName) continue;
            try {
                var t = new GlideRecord(tableName);
                t.addQuery('assignment_group', groupSysId);
                t.addNotNullQuery('assigned_to');
                t.query();
                while (t.next()) {
                    var assignedTo = t.getValue('assigned_to');
                    if (!notWorking[assignedTo]) continue;

                    // State proxies — incident/task convention: 1=New, 2=In Progress, 3=On Hold.
                    // (Per-table state mapping is a known config gap; see DATA_MODEL note for v2.)
                    var state = t.getValue('state');
                    var matched = false;
                    if (newSt && state == '1') matched = true;
                    if (inProgress && state == '2') matched = true;
                    if (ohToIp && state == '2') {
                        // Most recent state transition was from On Hold (3) → In Progress (2)
                        var aud = new GlideRecord('sys_audit');
                        aud.addQuery('tablename', tableName);
                        aud.addQuery('documentkey', t.getUniqueValue());
                        aud.addQuery('fieldname', 'state');
                        aud.orderByDesc('sys_created_on');
                        aud.setLimit(1);
                        aud.query();
                        if (aud.next() && aud.getValue('oldvalue') == '3' && aud.getValue('newvalue') == '2') {
                            matched = true;
                        }
                    }
                    if (!matched) continue;

                    t.assigned_to = '';
                    t.update();
                    logActivity(assignerSysId, tableName, t.getValue('number'),
                                t.getUniqueValue(), 'unassigned', assignedTo);
                }
            } catch (e) {
                gs.warn(TAG + ' reassign scan failed for ' + tableName + ': ' + e);
            }
        }
    }

    function logActivity(assignerSysId, tableName, ticketNumber, ticketSysId, action, analystSysId) {
        var log = new GlideRecord(SCOPE + 'activity_log');
        log.initialize();
        log.assigner = assignerSysId;
        log.ticket_table = tableName;
        log.ticket_number = ticketNumber || '';
        log.ticket_ref = ticketSysId;
        log.action = action;
        log.analyst = analystSysId;
        log.insert();
    }
})();
