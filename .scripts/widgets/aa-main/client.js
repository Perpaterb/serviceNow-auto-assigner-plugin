api.controller = function($scope, $interval) {
    var c = this;
    c.activeTab = 0;

    // Engine cadence is 5 minutes (sysauto_script.run_period).
    var CADENCE_MS = 5 * 60 * 1000;

    // Tick the countdowns every second. Pure client-side — no server load.
    var tickHandle = $interval(updateCountdowns, 1000);
    // Background poll: re-fetch last_run timestamps so the countdown rolls
    // over without forcing a page refresh. We only touch lastRunMs on the
    // local model so any in-flight UI state (open dropdowns, etc.) is
    // preserved.
    var pollHandle = $interval(pollLastRun, 15000);
    $scope.$on('$destroy', function() {
        $interval.cancel(tickHandle);
        $interval.cancel(pollHandle);
    });
    updateCountdowns(); // first paint without waiting 1s

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
        c.server.get({pollLastRun: true}).then(function(response) {
            if (!response || !response.data || !response.data.assigners) return;
            var fresh = {};
            for (var i = 0; i < response.data.assigners.length; i++) {
                fresh[response.data.assigners[i].sys_id] = response.data.assigners[i].lastRunMs;
            }
            for (var j = 0; j < c.data.assigners.length; j++) {
                var local = c.data.assigners[j];
                if (fresh.hasOwnProperty(local.sys_id)) {
                    local.lastRunMs = fresh[local.sys_id];
                }
            }
        });
    }

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
