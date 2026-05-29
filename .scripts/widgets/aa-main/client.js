api.controller = function($scope, $interval) {
    var c = this;
    c.activeTab = 0;

    var CADENCE_MS = 5 * 60 * 1000;

    var tickHandle = $interval(updateCountdowns, 1000);
    var pollHandle = $interval(pollLastRun, 15000);
    $scope.$on('$destroy', function() {
        $interval.cancel(tickHandle);
        $interval.cancel(pollHandle);
    });
    updateCountdowns();

    function updateCountdowns() {
        if (!c.data || !c.data.assigners) return;
        var now = Date.now();
        for (var i = 0; i < c.data.assigners.length; i++) {
            var a = c.data.assigners[i];
            a.countdown = formatCountdown(a, now);
        }
    }

    function formatCountdown(assigner, nowMs) {
        if (!assigner.lastRunMs) return null;
        var elapsed = nowMs - assigner.lastRunMs;
        var remaining = CADENCE_MS - elapsed;
        if (remaining <= 0) return 'any moment…';
        var secs = Math.floor(remaining / 1000);
        var m = Math.floor(secs / 60);
        var s = secs % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function pollLastRun() {
        c.server.get({ pollLastRun: true }).then(function(response) {
            if (!response || !response.data || !response.data.assigners) return;
            var fresh = {};
            for (var i = 0; i < response.data.assigners.length; i++) {
                fresh[response.data.assigners[i].sys_id] = response.data.assigners[i].lastRunMs;
            }
            for (var j = 0; j < c.data.assigners.length; j++) {
                var local = c.data.assigners[j];
                if (fresh.hasOwnProperty(local.sys_id)) local.lastRunMs = fresh[local.sys_id];
            }
        });
    }

    // ---- actions ----------------------------------------------------------

    c.toggleRunning = function(a) {
        c.data.action = 'toggleRunning';
        c.data.assignerSysId = a.sys_id;
        c.server.update().then(function() { a.running = !a.running; });
    };

    c.toggleWorking = function(a, entry) {
        var willWork = !entry.working;
        c.data.action = 'setWorking';
        c.data.rosterSysId = entry.sys_id;
        c.data.working = willWork;
        c.server.update().then(function(response) {
            entry.working = willWork;
            var fresh = findRosterEntry(response.data, a.sys_id, entry.sys_id);
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

    c.setRunTime = function(a, which) {
        c.data.action = 'setRunTime';
        c.data.assignerSysId = a.sys_id;
        c.data.which = which;
        c.data.value = which === 'start' ? a.run_start_time : a.run_end_time;
        c.server.update();
    };

    c.setBool = function(a, field) {
        c.data.action = 'setBool';
        c.data.assignerSysId = a.sys_id;
        c.data.field = field;
        c.data.value = !!a[field];
        c.server.update();
    };

    c.toggleTicketType = function(a, t) {
        c.data.action = 'toggleTicketType';
        c.data.assignerSysId = a.sys_id;
        c.data.tableName = t.table_name;
        c.data.enabled = !!t.enabled;
        c.server.update();
    };

    c.toggleReassignType = function(a, t) {
        c.data.action = 'toggleReassignType';
        c.data.assignerSysId = a.sys_id;
        c.data.tableName = t.table_name;
        c.data.enabled = !!t.enabled;
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
