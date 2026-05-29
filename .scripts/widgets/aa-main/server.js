(function() {
    var SCOPE = 'x_1578378_aa_';
    var userSysId = gs.getUserID();

    // Handle Start/Stop toggle from the client.
    if (input && input.action === 'toggleRunning' && input.assignerSysId) {
        var a = new GlideRecord(SCOPE + 'assigner');
        if (a.get(input.assignerSysId) && isUserInGroup(userSysId, a.getValue('assignment_group'))) {
            a.running = (a.running != true);
            a.update();
        }
    }

    data.user = gs.getUserDisplayName();
    data.isManager = gs.hasRole(SCOPE + 'queue_manager');
    data.assigners = [];

    var ar = new GlideRecord(SCOPE + 'assigner');
    ar.orderBy('name');
    ar.query();
    while (ar.next()) {
        var groupSysId = ar.getValue('assignment_group');
        if (!groupSysId) continue;
        if (!isUserInGroup(userSysId, groupSysId)) continue;

        data.assigners.push({
            sys_id: ar.getUniqueValue(),
            name: ar.name + '',
            assignment_group: ar.assignment_group.getDisplayValue(),
            running: ar.running == true,
            canManage: data.isManager,
            roster: getRoster(ar.getUniqueValue())
        });
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

    function isUserInGroup(userSysId, groupSysId) {
        var m = new GlideRecord('sys_user_grmember');
        m.addQuery('user', userSysId);
        m.addQuery('group', groupSysId);
        m.setLimit(1);
        m.query();
        return m.hasNext();
    }
})();
