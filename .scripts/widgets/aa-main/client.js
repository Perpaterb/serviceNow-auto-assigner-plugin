api.controller = function($scope) {
    var c = this;
    c.activeTab = 0;

    c.toggleRunning = function(assigner) {
        c.data.action = 'toggleRunning';
        c.data.assignerSysId = assigner.sys_id;
        c.server.update().then(function() {
            assigner.running = !assigner.running;
        });
    };

    c.toggleWorking = function(assigner, entry) {
        var willWork = !entry.working;
        c.data.action = 'setWorking';
        c.data.rosterSysId = entry.sys_id;
        c.data.working = willWork;
        c.server.update().then(function(response) {
            entry.working = willWork;
            // Re-sync the entry from the fresh server payload (server may
            // have auto-applied last_shift / default shift on move-to-working).
            var fresh = findRosterEntry(response.data, assigner.sys_id, entry.sys_id);
            if (fresh) {
                entry.shift = fresh.shift;
                entry.shift_sys_id = fresh.shift_sys_id;
            }
        });
    };

    c.setShift = function(entry) {
        c.data.action = 'setShift';
        c.data.rosterSysId = entry.sys_id;
        c.data.shiftSysId = entry.shift_sys_id;
        c.server.update();
    };

    function findRosterEntry(payload, assignerSysId, rosterSysId) {
        if (!payload || !payload.assigners) return null;
        for (var i = 0; i < payload.assigners.length; i++) {
            var a = payload.assigners[i];
            if (a.sys_id !== assignerSysId) continue;
            for (var j = 0; j < a.roster.length; j++) {
                if (a.roster[j].sys_id === rosterSysId) return a.roster[j];
            }
        }
        return null;
    }
};
