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

    var ar = new GlideRecord(SCOPE + 'assigner');
    ar.orderBy('name');
    ar.query();
    while (ar.next()) {
        var groupSysId = ar.getValue('assignment_group');
        if (!isAdmin && (!groupSysId || !isUserInGroup(userSysId, groupSysId))) continue;

        // Types that this specific group has actually had tickets assigned
        // to. Polymorphic query on `task` picks up every descendant including
        // custom ones like universal_task.
        var availableTables = getAssignableTypesForGroup(groupSysId);

        var assignerSysId = ar.getUniqueValue();
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

    // R6 — list of task types that *this group* has historically received
    // tickets for. Uses GlideAggregate on the parent `task` table; the
    // query is polymorphic, so every descendant (including custom ones
    // like universal_task) appears via its sys_class_name. Pretty labels
    // for common ITSM tables; raw name for everything else.
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

    function getAssignableTypesForGroup(groupSysId) {
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
            if (cls.indexOf(SCOPE) === 0) continue;
            seen[cls] = true;
            result.push({ name: cls, label: TABLE_LABELS[cls] || cls });
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
