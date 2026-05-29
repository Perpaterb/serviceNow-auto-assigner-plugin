(function() {
    var SCOPE = 'x_1578378_aa_';
    var userSysId = gs.getUserID();
    var isAdmin   = gs.hasRole('admin');
    var isManager = gs.hasRole(SCOPE + 'queue_manager');

    handleInput();

    data.user      = gs.getUserDisplayName();
    data.isAdmin   = isAdmin;
    data.isManager = isManager;
    data.assigners = [];

    var availableTables = getTaskDescendantsWithGroup();

    var ar = new GlideRecord(SCOPE + 'assigner');
    ar.orderBy('name');
    ar.query();
    while (ar.next()) {
        var groupSysId = ar.getValue('assignment_group');
        if (!isAdmin && (!groupSysId || !isUserInGroup(userSysId, groupSysId))) continue;

        var assignerSysId = ar.getUniqueValue();
        data.assigners.push({
            sys_id: assignerSysId,
            name: ar.name + '',
            assignment_group: ar.assignment_group.getDisplayValue() || '(none)',
            running: ar.running == true,
            canManage: canEditAssigner(ar),
            lastRunMs: ar.getValue('last_run') ? ar.last_run.dateNumericValue() : null,
            // R5 — run window
            run_start_time: hhmmFromTime(ar.run_start_time.getDisplayValue()),
            run_end_time:   hhmmFromTime(ar.run_end_time.getDisplayValue()),
            stop_overnight: ar.stop_overnight == true,
            // R7 — reassign-responded master + eligibility flags
            reassign_responded:                  ar.reassign_responded == true,
            reassign_state_in_progress:          ar.reassign_state_in_progress == true,
            reassign_state_new:                  ar.reassign_state_new == true,
            reassign_state_onhold_to_inprogress: ar.reassign_state_onhold_to_inprogress == true,
            shifts: getShifts(assignerSysId),
            roster: getRoster(assignerSysId),
            // R6 — ticket types: enabled + available
            ticketTypes:   getTypeRows(assignerSysId, SCOPE + 'ticket_type_selection',   availableTables),
            reassignTypes: getTypeRows(assignerSysId, SCOPE + 'reassign_type_selection', availableTables)
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
                    var v = ('' + (input.value || '')).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
                    if (!v) return;
                    var hhmmss = pad2(v[1]) + ':' + v[2] + ':' + (v[3] || '00');
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
        }
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

    function getShifts(assignerSysId) {
        var shifts = [];
        var s = new GlideRecord(SCOPE + 'shift');
        s.addQuery('assigner', assignerSysId);
        s.orderBy('name');
        s.query();
        while (s.next()) {
            shifts.push({ sys_id: s.getUniqueValue(), name: s.name + '' });
        }
        return shifts;
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
        for (var i = 0; i < available.length; i++) {
            var avail = available[i];
            var rec = existing[avail.name];
            rows.push({
                table_name: avail.name,
                label:      avail.label,
                enabled:    rec ? rec.enabled : false
            });
        }
        return rows;
    }

    // R6 — descendants of `task` whose dictionary has an `assignment_group`
    // reference column.
    function getTaskDescendantsWithGroup() {
        var taskTbl = new GlideRecord('sys_db_object');
        if (!taskTbl.get('name', 'task')) return [];

        // BFS over sys_db_object to collect every name that extends task.
        var found = {};
        var queue = [taskTbl.getUniqueValue()];
        while (queue.length) {
            var parentSysId = queue.shift();
            var children = new GlideRecord('sys_db_object');
            children.addQuery('super_class', parentSysId);
            children.query();
            while (children.next()) {
                var n = children.getValue('name');
                if (!n || found[n]) continue;
                found[n] = { name: n, label: children.getValue('label') || n };
                queue.push(children.getUniqueValue());
            }
        }

        // Keep only those whose dictionary has an assignment_group column.
        var result = [];
        for (var name in found) {
            var d = new GlideRecord('sys_dictionary');
            d.addQuery('name', name);
            d.addQuery('element', 'assignment_group');
            d.setLimit(1);
            d.query();
            if (d.hasNext()) result.push(found[name]);
        }
        result.sort(function(a, b) { return ('' + a.label).localeCompare('' + b.label); });
        return result;
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
        // glide_time display is "HH:MM:SS"; the <input type="time"> wants "HH:MM".
        var m = ('' + (disp || '')).match(/^(\d{2}):(\d{2})/);
        return m ? (m[1] + ':' + m[2]) : '';
    }

    function pad2(s) { s = '' + s; return s.length < 2 ? '0' + s : s; }
})();
