api.controller = function($scope) {
    var c = this;
    c.activeTab = 0;

    c.toggleRunning = function(assigner) {
        c.server.update({
            action: 'toggleRunning',
            assignerSysId: assigner.sys_id
        }).then(function() {
            assigner.running = !assigner.running;
        });
    };

    c.toggleWorking = function(assigner, entry) {
        var willWork = !entry.working;
        c.server.update({
            action: 'setWorking',
            rosterSysId: entry.sys_id,
            working: willWork
        }).then(function(response) {
            entry.working = willWork;
            // Re-sync this entry from the fresh server payload (server may have
            // auto-applied last_shift / default shift when moving into Working).
            var fresh = findRosterEntry(response.data, assigner.sys_id, entry.sys_id);
            if (fresh) {
                entry.shift = fresh.shift;
                entry.shift_sys_id = fresh.shift_sys_id;
            }
        });
    };

    c.setShift = function(entry) {
        c.server.update({
            action: 'setShift',
            rosterSysId: entry.sys_id,
            shiftSysId: entry.shift_sys_id
        });
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
