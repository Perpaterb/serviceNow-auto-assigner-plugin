(function() {
    var SCOPE = 'x_1578378_aa_';
    var userSysId = gs.getUserID();
    var isAdmin   = gs.hasRole('admin');
    var isManager = gs.hasRole(SCOPE + 'queue_manager');

    // The scheduled job that runs the engine (see generate_engine.py).
    var ENGINE_JOB_SYS_ID = '4a6860f1fc1b9fe361220028cfb23965';
    var ENGINE_JOB_NAME   = 'Auto-Assigner Engine';

    // Pastel palette offered for the per-assigner tab/panel colour. '' is the
    // default (no tint). Writes are validated against this list so only these
    // values can ever reach the ng-style binding.
    var BG_PALETTE = ['', '#FADBD8', '#FDEBD0', '#FCF3CF', '#D5F5E3', '#D1F2EB',
                      '#D6EAF8', '#E8DAEF', '#FADBE9', '#EAECEE', '#E5E0D8'];

    // Type-list config, declared up here so it's initialized before the
    // main loop runs (function declarations hoist; var initializations
    // do not).
    var PINNED_ORDER = [
        'incident', 'sc_req_item', 'sc_task', 'sc_request',
        'change_request', 'change_task',
        'problem', 'problem_task',
        'hr_case', 'hr_task',
        'sn_customerservice_case', 'sn_csm_task',
        'vtb_task'
    ];
    var EXCLUDED = {
        sysapproval_group:    1,
        sysapproval_approver: 1,
        sysapproval:          1,
        sys_trigger:          1
    };
    var TABLE_LABELS = {
        incident: 'Incident',
        problem: 'Problem',
        problem_task: 'Problem Task',
        change_request: 'Change Request',
        change_task: 'Change Task',
        sc_request: 'Catalog Request',
        sc_req_item: 'Catalog Item Request (RITM)',
        sc_task: 'Catalog Task',
        pm_project: 'Project',
        pm_project_task: 'Project Task',
        demand: 'Demand',
        rm_story: 'Story',
        rm_defect: 'Defect',
        rm_enhancement: 'Enhancement',
        hr_case: 'HR Case',
        hr_task: 'HR Task',
        sn_customerservice_case: 'Customer Service Case',
        sn_csm_task: 'CSM Task',
        vtb_task: 'Visual Task Board Task'
    };

    handleInput();

    data.user             = gs.getUserDisplayName();
    data.isAdmin          = isAdmin;
    data.isManager        = isManager;
    data.instanceNowDisplay = formatNowInSystemTz();
    data.availableGroups  = getAvailableGroups();
    // Absolute epoch-ms of the next scheduled engine fire. The countdown uses
    // this (shared by all assigners — one job drives them) so it stays correct
    // even right after an assigner is started, when its own last_run is stale.
    data.engineNextRunMs  = getEngineNextRunMs();
    data.bgPalette        = BG_PALETTE;
    data.assigners        = [];

    // The instance's wall-clock time formatted in the system default TZ
    // (NF6), not the admin's session TZ. Falls back to the session display
    // value if Java reflection is locked down on this instance.
    function formatNowInSystemTz() {
        try {
            var tzName = gs.getProperty('glide.sys.default.tz', 'UTC');
            var tz = Packages.java.util.TimeZone.getTimeZone(tzName);
            var df = new Packages.java.text.SimpleDateFormat('yyyy-MM-dd HH:mm:ss');
            df.setTimeZone(tz);
            return '' + df.format(new Packages.java.util.Date());
        } catch (e) {
            return (new GlideDateTime()).getDisplayValue();
        }
    }

    // When does the engine scheduled job next fire? The live value is held by
    // the scheduler in sys_trigger; fall back to the job record's own
    // next_action. Returns absolute epoch ms, or null if it can't be read.
    function getEngineNextRunMs() {
        var ms = triggerNextActionMs('document_key', ENGINE_JOB_SYS_ID);
        if (ms) return ms;
        ms = triggerNextActionMs('name', ENGINE_JOB_NAME);
        if (ms) return ms;
        try {
            var job = new GlideRecord('sysauto_script');
            if (job.get(ENGINE_JOB_SYS_ID) && job.getValue('next_action')) {
                var jms = job.next_action.dateNumericValue();
                if (jms) return jms;
            }
        } catch (e) {
            gs.warn('[aa-main] could not read sysauto_script next_action: ' + e);
        }
        return null;
    }

    function triggerNextActionMs(field, value) {
        try {
            var t = new GlideRecord('sys_trigger');
            t.addQuery(field, value);
            t.addNotNullQuery('next_action');
            t.orderBy('next_action');
            t.setLimit(1);
            t.query();
            if (t.next()) {
                var ms = t.next_action.dateNumericValue();
                if (ms) return ms;
            }
        } catch (e) {
            gs.warn('[aa-main] sys_trigger read failed (' + field + '): ' + e);
        }
        return null;
    }

    var ar = new GlideRecord(SCOPE + 'assigner');
    ar.orderBy('name');
    ar.query();
    while (ar.next()) {
        var groupSysId = ar.getValue('assignment_group');
        if (!isAdmin && (!groupSysId || !isUserInGroup(userSysId, groupSysId))) continue;

        var assignerSysId = ar.getUniqueValue();

        // Keep the roster in sync with current group membership so newly-
        // added members appear immediately instead of after the next engine
        // cycle (and so removed members get soft-deactivated promptly).
        if (groupSysId) reconcileRosterFromGroup(assignerSysId, groupSysId);

        // Types that this specific group has actually had tickets assigned
        // to. Polymorphic query on `task` picks up every descendant including
        // custom ones like universal_task.
        var availableTables = getAssignableTypesForGroup(groupSysId);

        // Diagnostic — what does the platform actually return for these fields?
        gs.info('[aa-main] ' + ar.name + ' run_start raw="' + ar.getValue('run_start_time')
                + '" display="' + ar.run_start_time.getDisplayValue() + '"'
                + ' run_end raw="' + ar.getValue('run_end_time')
                + '" display="' + ar.run_end_time.getDisplayValue() + '"');
        data.assigners.push({
            sys_id: assignerSysId,
            name: ar.name + '',
            assignment_group: ar.assignment_group.getDisplayValue() || '(none)',
            running: ar.running == true,
            bg_color: ar.getValue('bg_color') || '',
            canManage: canEditAssigner(ar),
            lastRunMs: ar.getValue('last_run') ? ar.last_run.dateNumericValue() : null,
            // R5 — run window
            run_start_time: hhmmFromTime(ar.run_start_time.getDisplayValue()),
            run_end_time:   hhmmFromTime(ar.run_end_time.getDisplayValue()),
            stop_overnight: ar.stop_overnight == true,
            // R7 — reassign-responded master
            reassign_responded:                  ar.reassign_responded == true,
            shifts: getShifts(assignerSysId),
            roster: getRoster(assignerSysId),
            roundRobinOrder: getRoundRobinOrder(assignerSysId),
            activityLog:     getActivityLog(assignerSysId),
            // R6 — ticket types: enabled + available
            ticketTypes:   getTypeRows(assignerSysId, SCOPE + 'ticket_type_selection',   availableTables),
            reassignTypes: getTypeRows(assignerSysId, SCOPE + 'reassign_type_selection', availableTables),
            // R7 — states derived from sys_choice for the enabled reassign types
            reassignStates: getReassignStateRows(assignerSysId)
        });
    }

    function handleInput() {
        if (!input || !input.action) return;
        switch (input.action) {
            case 'toggleRunning':
                editAssigner(input.assignerSysId, function(a) { a.running = (a.running != true); });
                break;
            case 'setWorking':
                editRoster(input.rosterSysId, function(r) {
                    var willWork = !!input.working;
                    r.working = willWork;
                    if (willWork && !r.getValue('shift')) {
                        var preferred = r.getValue('last_shift') || findDefaultShift(r.getValue('assigner'));
                        if (preferred) r.shift = preferred;
                    }
                });
                break;
            case 'setShift':
                editRoster(input.rosterSysId, function(r) {
                    r.shift = input.shiftSysId || '';
                    if (input.shiftSysId) r.last_shift = input.shiftSysId;
                });
                break;
            case 'setRunTime':
                editAssigner(input.assignerSysId, function(a) {
                    var hhmmss = toHhmmss(input.value);
                    if (!hhmmss) return;
                    if (input.which === 'start')      a.run_start_time = hhmmss;
                    else if (input.which === 'end')   a.run_end_time   = hhmmss;
                });
                break;
            case 'setBool':
                var allowed = { stop_overnight: 1, reassign_responded: 1,
                                reassign_state_in_progress: 1, reassign_state_new: 1,
                                reassign_state_onhold_to_inprogress: 1 };
                if (!allowed[input.field]) break;
                editAssigner(input.assignerSysId, function(a) {
                    a.setValue(input.field, !!input.value);
                });
                break;
            case 'toggleTicketType':
            case 'toggleReassignType':
                var typeTable = SCOPE + (input.action === 'toggleTicketType' ? 'ticket_type_selection' : 'reassign_type_selection');
                if (!canEditAssignerById(input.assignerSysId)) break;
                upsertType(typeTable, input.assignerSysId, input.tableName, !!input.enabled);
                break;
            case 'toggleReassignState':
                if (!canEditAssignerById(input.assignerSysId)) break;
                upsertReassignState(input.assignerSysId, input.tableName, input.stateValue, !!input.enabled);
                break;
            case 'createAssigner':
                createAssigner(input.name, input.groupSysId);
                break;
            case 'renameAssigner':
                editAssigner(input.assignerSysId, function(a) {
                    var nm = ('' + (input.name || '')).trim();
                    if (nm) a.name = nm.substring(0, 100);
                });
                break;
            case 'setBgColor':
                var color = '' + (input.color || '');
                if (BG_PALETTE.indexOf(color) === -1) break; // only known swatches
                editAssigner(input.assignerSysId, function(a) { a.bg_color = color; });
                break;
            case 'deleteAssigner':
                deleteAssigner(input.assignerSysId);
                break;
            case 'addShift':
                addShift(input.assignerSysId, input.name, input.start, input.end);
                break;
            case 'updateShift':
                editShift(input.shiftSysId, function(s) {
                    var nm = ('' + (input.name || '')).trim();
                    var st = toHhmmss(input.start);
                    var en = toHhmmss(input.end);
                    if (nm) s.name = nm.substring(0, 100);
                    if (st) s.start_time = st;
                    if (en) s.end_time = en;
                });
                break;
            case 'deleteShift':
                deleteShift(input.shiftSysId);
                break;
            case 'addBreak':
                addBreak(input.shiftSysId, input.start, input.end);
                break;
            case 'updateBreak':
                editBreak(input.breakSysId, function(b) {
                    var st = toHhmmss(input.start);
                    var en = toHhmmss(input.end);
                    if (st) b.start_time = st;
                    if (en) b.end_time = en;
                });
                break;
            case 'deleteBreak':
                deleteBreak(input.breakSysId);
                break;
        }
    }

    function createAssigner(name, groupSysId) {
        if (!name || !groupSysId) return;
        // Non-admins must be in the group they're creating an assigner for.
        if (!isAdmin && !isUserInGroup(userSysId, groupSysId)) return;
        var a = new GlideRecord(SCOPE + 'assigner');
        a.initialize();
        a.name = ('' + name).substring(0, 100);
        a.assignment_group = groupSysId;
        a.running = false;
        a.run_start_time = '00:00:00';
        a.run_end_time   = '23:59:59';
        a.stop_overnight = false;
        a.insert();
        // Seed BR auto-creates the Default shift on insert.
    }

    // Cascade-delete an assigner and every record that references it. The
    // child tables store the assigner (and shift) as plain sys_id strings, so
    // nothing is cleaned up automatically — we sweep each one here.
    function deleteAssigner(assignerSysId) {
        if (!canEditAssignerById(assignerSysId)) return;

        // shift_break rows hang off shifts, not the assigner — collect the
        // assigner's shift ids first, then purge their breaks.
        var shiftIds = [];
        var s = new GlideRecord(SCOPE + 'shift');
        s.addQuery('assigner', assignerSysId);
        s.query();
        while (s.next()) shiftIds.push(s.getUniqueValue());
        if (shiftIds.length) {
            var br = new GlideRecord(SCOPE + 'shift_break');
            br.addQuery('shift', 'IN', shiftIds.join(','));
            br.deleteMultiple();
        }

        deleteChildren(SCOPE + 'shift', assignerSysId);
        deleteChildren(SCOPE + 'roster_entry', assignerSysId);
        deleteChildren(SCOPE + 'ticket_type_selection', assignerSysId);
        deleteChildren(SCOPE + 'reassign_type_selection', assignerSysId);
        deleteChildren(SCOPE + 'reassign_state_selection', assignerSysId);
        deleteChildren(SCOPE + 'activity_log', assignerSysId);

        var a = new GlideRecord(SCOPE + 'assigner');
        if (a.get(assignerSysId)) a.deleteRecord();
    }

    function deleteChildren(table, assignerSysId) {
        var g = new GlideRecord(table);
        g.addQuery('assigner', assignerSysId);
        g.deleteMultiple();
    }

    // R3.4 — shifts may only be created/edited/deleted while the assigner is
    // stopped. Combines the manage-permission check with that gate.
    function canEditShifts(assignerSysId) {
        if (!canEditAssignerById(assignerSysId)) return false;
        var a = new GlideRecord(SCOPE + 'assigner');
        return a.get(assignerSysId) && a.running != true;
    }

    function addShift(assignerSysId, name, start, end) {
        if (!canEditShifts(assignerSysId)) return;
        var nm = ('' + (name || '')).trim();
        var st = toHhmmss(start);
        var en = toHhmmss(end);
        if (!nm || !st || !en) return;
        var s = new GlideRecord(SCOPE + 'shift');
        s.initialize();
        s.assigner   = assignerSysId;
        s.name       = nm.substring(0, 100);
        s.start_time = st;
        s.end_time   = en;
        s.is_default = false;
        s.insert();
    }

    function editShift(shiftSysId, mutator) {
        if (!shiftSysId) return;
        var s = new GlideRecord(SCOPE + 'shift');
        if (!s.get(shiftSysId)) return;
        if (!canEditShifts(s.getValue('assigner'))) return;
        mutator(s);
        s.update();
    }

    function deleteShift(shiftSysId) {
        if (!shiftSysId) return;
        var s = new GlideRecord(SCOPE + 'shift');
        if (!s.get(shiftSysId)) return;
        var assignerSysId = s.getValue('assigner');
        if (!canEditShifts(assignerSysId)) return;
        // The default shift is the fallback for newly-working analysts; keep it.
        if (s.is_default == true) return;

        var br = new GlideRecord(SCOPE + 'shift_break');
        br.addQuery('shift', shiftSysId);
        br.deleteMultiple();

        // R3.4 — analysts on a deleted shift fall back to the Default shift
        // rather than being left with no shift.
        var defaultShiftSysId = findDefaultShift(assignerSysId);
        reassignRosterShift('shift', shiftSysId, defaultShiftSysId);
        reassignRosterShift('last_shift', shiftSysId, defaultShiftSysId);

        s.deleteRecord();
    }

    function reassignRosterShift(field, fromShiftSysId, toShiftSysId) {
        var r = new GlideRecord(SCOPE + 'roster_entry');
        r.addQuery(field, fromShiftSysId);
        r.query();
        while (r.next()) {
            r.setValue(field, toShiftSysId || '');
            r.update();
        }
    }

    function addBreak(shiftSysId, start, end) {
        if (!shiftSysId) return;
        var s = new GlideRecord(SCOPE + 'shift');
        if (!s.get(shiftSysId)) return;
        if (!canEditShifts(s.getValue('assigner'))) return;
        var st = toHhmmss(start);
        var en = toHhmmss(end);
        if (!st || !en) return;
        var b = new GlideRecord(SCOPE + 'shift_break');
        b.initialize();
        b.shift      = shiftSysId;
        b.start_time = st;
        b.end_time   = en;
        b.insert();
    }

    function editBreak(breakSysId, mutator) {
        var b = getEditableBreak(breakSysId);
        if (!b) return;
        mutator(b);
        b.update();
    }

    function deleteBreak(breakSysId) {
        var b = getEditableBreak(breakSysId);
        if (b) b.deleteRecord();
    }

    // Fetch a break row only if the caller may edit its parent assigner.
    function getEditableBreak(breakSysId) {
        if (!breakSysId) return null;
        var b = new GlideRecord(SCOPE + 'shift_break');
        if (!b.get(breakSysId)) return null;
        var s = new GlideRecord(SCOPE + 'shift');
        if (!s.get(b.getValue('shift'))) return null;
        if (!canEditShifts(s.getValue('assigner'))) return null;
        return b;
    }

    // Normalize "H:MM" / "HH:MM" / "HH:MM:SS" to "HH:MM:SS", or null if the
    // value isn't a valid 24-hour time. "24:00(:00)" folds to "00:00:00".
    function toHhmmss(value) {
        var v = ('' + (value || '')).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (!v) return null;
        var hh = parseInt(v[1], 10), mm = parseInt(v[2], 10), ss = v[3] ? parseInt(v[3], 10) : 0;
        if (hh === 24 && mm === 0 && ss === 0) hh = 0;
        if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
        return pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss);
    }

    function editAssigner(sysId, mutator) {
        if (!sysId) return;
        var a = new GlideRecord(SCOPE + 'assigner');
        if (!a.get(sysId) || !canEditAssigner(a)) return;
        mutator(a);
        a.update();
    }

    function canEditAssignerById(sysId) {
        var a = new GlideRecord(SCOPE + 'assigner');
        return a.get(sysId) && canEditAssigner(a);
    }

    function editRoster(rosterSysId, mutator) {
        if (!rosterSysId) return;
        var r = new GlideRecord(SCOPE + 'roster_entry');
        if (!r.get(rosterSysId)) return;
        var a = new GlideRecord(SCOPE + 'assigner');
        if (!a.get(r.getValue('assigner')) || !canEditAssigner(a)) return;
        mutator(r);
        r.update();
    }

    function upsertType(typeTable, assignerSysId, tableName, enabled) {
        if (!tableName) return;
        var t = new GlideRecord(typeTable);
        t.addQuery('assigner', assignerSysId);
        t.addQuery('table_name', tableName);
        t.setLimit(1);
        t.query();
        if (t.next()) {
            t.enabled = enabled;
            t.update();
        } else {
            t.initialize();
            t.assigner = assignerSysId;
            t.table_name = tableName;
            t.enabled = enabled;
            t.insert();
        }
    }

    function findDefaultShift(assignerSysId) {
        var s = new GlideRecord(SCOPE + 'shift');
        s.addQuery('assigner', assignerSysId);
        s.addQuery('is_default', true);
        s.setLimit(1);
        s.query();
        return s.next() ? s.getUniqueValue() : null;
    }

    function canEditAssigner(a) {
        if (isAdmin) return true;
        if (!isManager) return false;
        var g = a.getValue('assignment_group');
        return !!g && isUserInGroup(userSysId, g);
    }

    // Mirror of the engine's reconcile step so the widget never shows a
    // stale roster. Adds rows for new group members and soft-deactivates
    // rows for ex-members.
    function reconcileRosterFromGroup(assignerSysId, groupSysId) {
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
            existing.setLimit(1);
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
        var rosters = new GlideRecord(SCOPE + 'roster_entry');
        rosters.addQuery('assigner', assignerSysId);
        rosters.addQuery('active', true);
        rosters.query();
        while (rosters.next()) {
            if (!memberSet[rosters.getValue('analyst')]) {
                rosters.active = false;
                rosters.update();
            }
        }
    }

    // R8 — activity log entries created since midnight today for this
    // assigner. Capped at 500 to keep payload sane on busy queues.
    function getActivityLog(assignerSysId) {
        var entries = [];
        var log = new GlideRecord(SCOPE + 'activity_log');
        log.addQuery('assigner', assignerSysId);
        log.addQuery('sys_created_on', '>=', gs.beginningOfToday());
        log.orderByDesc('sys_created_on');
        // Tie-break within a cycle: sys_created_on is only second-resolution,
        // so a whole cycle's rows share one second. sequence restores the
        // true assignment order within that second.
        log.orderByDesc('sequence');
        log.setLimit(500);
        log.query();
        while (log.next()) {
            entries.push({
                sys_id:    log.getUniqueValue(),
                number:    log.getValue('ticket_number') || '',
                table:     log.getValue('ticket_table') || '',
                action:    log.getValue('action') || '',
                analyst:   log.analyst.getDisplayValue() || '',
                timestamp: log.sys_created_on.getDisplayValue() || ''
            });
        }
        return entries;
    }

    // Mirror of the engine's eligibility list so the manager can see who
    // gets the next ticket. Sorted oldest-last-assigned first.
    function getRoundRobinOrder(assignerSysId) {
        var nowSec = secondsOfDayDisplay();
        var eligible = [];
        var rosters = new GlideRecord(SCOPE + 'roster_entry');
        rosters.addQuery('assigner', assignerSysId);
        rosters.addQuery('active', true);
        rosters.addQuery('working', true);
        rosters.addNotNullQuery('shift');
        rosters.orderBy('last_assigned_at');
        rosters.orderBy('sys_id');
        rosters.query();
        while (rosters.next()) {
            var shiftSysId = rosters.getValue('shift');
            var shift = new GlideRecord(SCOPE + 'shift');
            if (!shift.get(shiftSysId)) continue;
            var startSec = hhmmssToSec(shift.start_time.getDisplayValue());
            var endSec   = hhmmssToSec(shift.end_time.getDisplayValue());
            if (startSec === null || endSec === null) continue;
            if (nowSec < startSec || nowSec > endSec) continue;
            if (isOnBreakAt(shiftSysId, nowSec)) continue;

            eligible.push({
                roster_sys_id:    rosters.getUniqueValue(),
                analyst:          rosters.analyst.getDisplayValue(),
                shift_name:       '' + shift.name,
                last_assigned_at: rosters.last_assigned_at.getDisplayValue() || ''
            });
        }
        return eligible;
    }

    function secondsOfDayDisplay() {
        var disp = (new GlideDateTime()).getDisplayValue();
        var hhmmss = disp.substring(11);
        var p = hhmmss.split(':');
        return parseInt(p[0], 10) * 3600 + parseInt(p[1], 10) * 60 + parseInt(p[2], 10);
    }

    function hhmmssToSec(disp) {
        if (!disp) return null;
        var m = ('' + disp).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (!m) return null;
        var hh = parseInt(m[1], 10);
        if (/PM/i.test(disp) && hh < 12) hh += 12;
        if (/AM/i.test(disp) && hh === 12) hh = 0;
        return hh * 3600 + parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0);
    }

    function isOnBreakAt(shiftSysId, nowSec) {
        var breaks = new GlideRecord(SCOPE + 'shift_break');
        breaks.addQuery('shift', shiftSysId);
        breaks.query();
        while (breaks.next()) {
            var s = hhmmssToSec(breaks.start_time.getDisplayValue());
            var e = hhmmssToSec(breaks.end_time.getDisplayValue());
            if (s === null || e === null) continue;
            if (nowSec >= s && nowSec <= e) return true;
        }
        return false;
    }

    function getShifts(assignerSysId) {
        var shifts = [];
        var s = new GlideRecord(SCOPE + 'shift');
        s.addQuery('assigner', assignerSysId);
        s.orderBy('name');
        s.query();
        while (s.next()) {
            shifts.push({
                sys_id:     s.getUniqueValue(),
                name:       s.name + '',
                start_time: hhmmFromTime(s.start_time.getDisplayValue()),
                end_time:   hhmmFromTime(s.end_time.getDisplayValue()),
                is_default: s.is_default == true,
                breaks:     getBreaks(s.getUniqueValue())
            });
        }
        return shifts;
    }

    function getBreaks(shiftSysId) {
        var breaks = [];
        var b = new GlideRecord(SCOPE + 'shift_break');
        b.addQuery('shift', shiftSysId);
        b.orderBy('start_time');
        b.query();
        while (b.next()) {
            breaks.push({
                sys_id:     b.getUniqueValue(),
                start_time: hhmmFromTime(b.start_time.getDisplayValue()),
                end_time:   hhmmFromTime(b.end_time.getDisplayValue())
            });
        }
        return breaks;
    }

    function getRoster(assignerSysId) {
        var roster = [];
        var r = new GlideRecord(SCOPE + 'roster_entry');
        r.addQuery('assigner', assignerSysId);
        r.addQuery('active', true);
        r.orderBy('analyst');
        r.query();
        while (r.next()) {
            roster.push({
                sys_id: r.getUniqueValue(),
                analyst: r.analyst.getDisplayValue(),
                analyst_sys_id: r.getValue('analyst'),
                working: r.working == true,
                shift: r.shift.getDisplayValue(),
                shift_sys_id: r.getValue('shift')
            });
        }
        return roster;
    }

    function upsertReassignState(assignerSysId, tableName, stateValue, enabled) {
        if (!tableName || !stateValue) return;
        var s = new GlideRecord(SCOPE + 'reassign_state_selection');
        s.addQuery('assigner', assignerSysId);
        s.addQuery('table_name', tableName);
        s.addQuery('state_value', stateValue);
        s.setLimit(1);
        s.query();
        if (s.next()) {
            s.enabled = enabled;
            s.update();
        } else {
            s.initialize();
            s.assigner    = assignerSysId;
            s.table_name  = tableName;
            s.state_value = stateValue;
            s.enabled     = enabled;
            s.insert();
        }
    }

    // R7 — state list for the reassign-responded section. Derived from
    // sys_choice on the `state` field of every currently-enabled reassign
    // type. Each row is (table_name, state_value, label, enabled).
    function getReassignStateRows(assignerSysId) {
        // Currently-enabled reassign types
        var enabledTypes = [];
        var rt = new GlideRecord(SCOPE + 'reassign_type_selection');
        rt.addQuery('assigner', assignerSysId);
        rt.addQuery('enabled', true);
        rt.query();
        while (rt.next()) enabledTypes.push(rt.getValue('table_name'));

        // Existing state-selection rows for this assigner (by table+value)
        var existing = {};
        var es = new GlideRecord(SCOPE + 'reassign_state_selection');
        es.addQuery('assigner', assignerSysId);
        es.query();
        while (es.next()) {
            existing[es.getValue('table_name') + '|' + es.getValue('state_value')] = es.enabled == true;
        }

        // Available states for each enabled type. Try sys_choice first; if
        // that returns nothing for a table (cross-scope reads, custom
        // choice resolvers, etc.) fall back to GlideElement.getChoices()
        // off a probe record.
        var rows = [];
        var seen = {};
        for (var i = 0; i < enabledTypes.length; i++) {
            var tableName = enabledTypes[i];
            var found = 0;
            try {
                var ch = new GlideRecord('sys_choice');
                ch.addQuery('name', tableName);
                ch.addQuery('element', 'state');
                ch.addQuery('inactive', false);
                ch.orderBy('sequence');
                ch.orderBy('value');
                ch.query();
                while (ch.next()) {
                    var value = ch.getValue('value');
                    var key   = tableName + '|' + value;
                    if (!value || seen[key]) continue;
                    seen[key] = true;
                    rows.push({
                        table_name: tableName,
                        state_value: value,
                        label: ch.getValue('label') || value,
                        enabled: existing[key] === true
                    });
                    found++;
                }
            } catch (e) {
                gs.warn('[aa-main] sys_choice lookup failed for ' + tableName + ': ' + e);
            }
            if (found === 0) {
                try {
                    var probe = new GlideRecord(tableName);
                    var elem  = probe.getElement('state');
                    if (elem) {
                        var choices = elem.getChoices();
                        var labels  = elem.getChoiceLabels ? elem.getChoiceLabels() : null;
                        for (var ci = 0; ci < choices.length; ci++) {
                            var v   = '' + choices[ci];
                            var key2 = tableName + '|' + v;
                            if (!v || seen[key2]) continue;
                            seen[key2] = true;
                            var lbl = labels && labels[ci] ? ('' + labels[ci]) : v;
                            rows.push({
                                table_name: tableName,
                                state_value: v,
                                label: lbl,
                                enabled: existing[key2] === true
                            });
                            found++;
                        }
                    }
                } catch (e2) {
                    gs.warn('[aa-main] getChoices fallback failed for ' + tableName + ': ' + e2);
                }
            }
            gs.info('[aa-main] reassign states for ' + tableName + ': ' + found + ' entries');
        }
        return rows;
    }

    function getTypeRows(assignerSysId, typeTable, available) {
        var existing = {};
        var t = new GlideRecord(typeTable);
        t.addQuery('assigner', assignerSysId);
        t.query();
        while (t.next()) {
            existing[t.getValue('table_name')] = {
                sys_id:  t.getUniqueValue(),
                enabled: t.enabled == true
            };
        }
        var rows = [];
        var seen = {};
        for (var i = 0; i < available.length; i++) {
            var avail = available[i];
            var rec = existing[avail.name];
            rows.push({
                table_name: avail.name,
                label:      avail.label,
                enabled:    rec ? rec.enabled : false
            });
            seen[avail.name] = true;
        }
        // Surface any previously-configured types that aren't in the curated
        // list so the user can still see / remove them.
        for (var name in existing) {
            if (seen[name]) continue;
            rows.push({
                table_name: name,
                label:      name,
                enabled:    existing[name].enabled
            });
        }
        return rows;
    }

    // R6 — full list of `task` descendants on this instance, sorted with
    // the common ITSM ones pinned to the top with friendly labels. Custom
    // descendants (like an org-specific universal_task) appear below with
    // their raw name.
    //
    // Walks sys_db_object via BFS over the super_class chain. If the
    // cross-scope read fails (returns 0 descendants), we fall back to the
    // group-history query so the list isn't empty.
    function getAllTaskDescendants() {
        var task = new GlideRecord('sys_db_object');
        if (!task.get('name', 'task')) {
            gs.warn('[aa-main] could not resolve `task` in sys_db_object — falling back');
            return null;
        }
        var found = {};
        var queue = [task.getUniqueValue()];
        var loops = 0;
        while (queue.length && loops++ < 5000) {
            var parentSysId = queue.shift();
            var children = new GlideRecord('sys_db_object');
            children.addQuery('super_class', parentSysId);
            children.query();
            while (children.next()) {
                var n = children.getValue('name');
                if (!n || found[n]) continue;
                found[n] = true;
                queue.push(children.getUniqueValue());
            }
        }

        var result = [];
        for (var name in found) {
            if (EXCLUDED[name]) continue;
            if (name.indexOf(SCOPE) === 0) continue;
            // Verify the table is still queryable with an assignment_group field.
            var probe = new GlideRecord(name);
            if (probe.isValidField && !probe.isValidField('assignment_group')) continue;
            result.push({ name: name, label: TABLE_LABELS[name] || name });
        }
        result.sort(byPinnedThenAlpha);
        return result;
    }

    function getAssignableTypesForGroup(groupSysId) {
        var all = getAllTaskDescendants();
        if (all && all.length) return all;

        // Fallback: empirical types historically routed to this group.
        if (!groupSysId) return [];
        var seen = {};
        var ag = new GlideAggregate('task');
        ag.addQuery('assignment_group', groupSysId);
        ag.addAggregate('COUNT');
        ag.groupBy('sys_class_name');
        ag.query();
        var result = [];
        while (ag.next()) {
            var cls = ag.getValue('sys_class_name');
            if (!cls || cls === 'task' || seen[cls]) continue;
            if (EXCLUDED[cls]) continue;
            if (cls.indexOf(SCOPE) === 0) continue;
            seen[cls] = true;
            result.push({ name: cls, label: TABLE_LABELS[cls] || cls });
        }
        result.sort(byPinnedThenAlpha);
        return result;
    }

    function byPinnedThenAlpha(a, b) {
        var ai = PINNED_ORDER.indexOf(a.name);
        var bi = PINNED_ORDER.indexOf(b.name);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return ('' + a.label).localeCompare('' + b.label);
    }

    // Groups this user can create an assigner for. Admin sees every active
    // group on the instance; everyone else only the ones they're a member of.
    function getAvailableGroups() {
        var groups = [];
        if (isAdmin) {
            var g = new GlideRecord('sys_user_group');
            g.addQuery('active', true);
            g.orderBy('name');
            g.setLimit(1000);
            g.query();
            while (g.next()) {
                groups.push({ sys_id: g.getUniqueValue(), name: '' + g.name });
            }
        } else {
            var m = new GlideRecord('sys_user_grmember');
            m.addQuery('user', userSysId);
            m.query();
            var seen = {};
            while (m.next()) {
                var gid = m.getValue('group');
                if (!gid || seen[gid]) continue;
                seen[gid] = true;
                groups.push({ sys_id: gid, name: m.group.getDisplayValue() });
            }
            groups.sort(function (a, b) { return ('' + a.name).localeCompare('' + b.name); });
        }
        return groups;
    }

    function isUserInGroup(userSysId, groupSysId) {
        var m = new GlideRecord('sys_user_grmember');
        m.addQuery('user', userSysId);
        m.addQuery('group', groupSysId);
        m.setLimit(1);
        m.query();
        return m.hasNext();
    }

    function hhmmFromTime(disp) {
        // glide_time display can be "HH:MM:SS" (24-hour) or "h:MM:SS a" (12-hour
        // with AM/PM, depending on user locale). <input type="time"> wants "HH:MM".
        var s = '' + (disp || '');
        var m = s.match(/(\d{1,2}):(\d{2})/);
        if (!m) return '';
        var hh = parseInt(m[1], 10);
        if (/PM/i.test(s) && hh < 12) hh += 12;
        if (/AM/i.test(s) && hh === 12) hh = 0;
        return (hh < 10 ? '0' : '') + hh + ':' + m[2];
    }

    function pad2(s) { s = '' + s; return s.length < 2 ? '0' + s : s; }
})();
