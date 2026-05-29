api.controller = function($scope, $interval) {
    var c = this;
    c.activeTab = 0;

    var CADENCE_MS = 5 * 60 * 1000;

    // Skew between this browser's local clock and the instance's wall-clock,
    // computed from the formatted instance time string. Treats the instance's
    // wall-clock as if it were a local-TZ Date; the local Date methods then
    // hand back hours/minutes/seconds that reflect the *instance* clock.
    c.serverClockSkewMs = computeInstanceSkew(c.data && c.data.instanceNowDisplay);

    function computeInstanceSkew(disp) {
        if (!disp) return 0;
        var m = ('' + disp).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
        if (!m) return 0;
        var faked = new Date(
            parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10),
            parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6], 10)
        ).getTime();
        return faked - Date.now();
    }

    var tickHandle  = $interval(updateCountdowns, 1000);
    var clockHandle = $interval(updateInstanceClock, 1000);
    var pollHandle  = $interval(pollLastRun, 15000);
    $scope.$on('$destroy', function() {
        $interval.cancel(tickHandle);
        $interval.cancel(clockHandle);
        $interval.cancel(pollHandle);
    });
    updateCountdowns();
    updateInstanceClock();
    initRunTimeDates();

    // AngularJS `<input type=time>` needs a Date object on ng-model, not an
    // HH:MM string. We keep our string fields as the source of truth and
    // mirror them onto Date instances the picker can bind to.
    function initRunTimeDates() {
        if (!c.data || !c.data.assigners) return;
        for (var i = 0; i < c.data.assigners.length; i++) {
            var a = c.data.assigners[i];
            a.run_start_date = hhmmToDate(a.run_start_time);
            a.run_end_date   = hhmmToDate(a.run_end_time);
        }
    }

    function hhmmToDate(s) {
        if (!s) return null;
        var m = ('' + s).match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        var d = new Date();
        d.setHours(parseInt(m[1], 10));
        d.setMinutes(parseInt(m[2], 10));
        d.setSeconds(0);
        d.setMilliseconds(0);
        return d;
    }

    function dateToHhmm(d) {
        if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
        return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }

    function updateCountdowns() {
        if (!c.data || !c.data.assigners) return;
        var now = Date.now();
        for (var i = 0; i < c.data.assigners.length; i++) {
            var a = c.data.assigners[i];
            a.countdown = formatCountdown(a, now);
        }
    }

    function updateInstanceClock() {
        var instanceMs = Date.now() + c.serverClockSkewMs;
        var d = new Date(instanceMs);
        c.instanceClockDisplay = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

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
            if (!response || !response.data) return;
            if (response.data.instanceNowDisplay) {
                c.serverClockSkewMs = computeInstanceSkew(response.data.instanceNowDisplay);
            }
            if (!response.data.assigners) return;
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
        var d = which === 'start' ? a.run_start_date : a.run_end_date;
        var hhmm = dateToHhmm(d);
        if (!hhmm) return;
        // Mirror back to the string field so other parts of the UI stay in sync.
        if (which === 'start') a.run_start_time = hhmm;
        else                   a.run_end_time   = hhmm;
        c.data.action = 'setRunTime';
        c.data.assignerSysId = a.sys_id;
        c.data.which = which;
        c.data.value = hhmm;
        c.server.update();
    };

    c.setBool = function(a, field) {
        c.data.action = 'setBool';
        c.data.assignerSysId = a.sys_id;
        c.data.field = field;
        c.data.value = !!a[field];
        c.server.update();
    };

    c.setTicketType = function(a, t, enabled) {
        t.enabled = enabled;
        c.data.action = 'toggleTicketType';
        c.data.assignerSysId = a.sys_id;
        c.data.tableName = t.table_name;
        c.data.enabled = enabled;
        c.server.update();
    };

    c.setReassignType = function(a, t, enabled) {
        t.enabled = enabled;
        c.data.action = 'toggleReassignType';
        c.data.assignerSysId = a.sys_id;
        c.data.tableName = t.table_name;
        c.data.enabled = enabled;
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
