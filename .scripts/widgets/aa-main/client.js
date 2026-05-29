api.controller = function($scope, $interval) {
    var c = this;
    // Open on the first assigner (index 0). Only land on the "New assigner"
    // tab (index -1) when there are no assigners yet.
    c.activeTab = (c.data && c.data.assigners && c.data.assigners.length) ? 0 : -1;

    // Per-assigner expanded/collapsed state for the collapsible sections.
    // Kept on the controller (not c.data) so it survives the c.data
    // replacement that c.server.update() does, and persisted to
    // localStorage so page reloads also remember the choice.
    var STORAGE_KEY = 'aa-main:expanded';
    try {
        c.sectionState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
        c.sectionState = {};
    }

    c.toggleSection = function(a, key) {
        if (!c.sectionState[a.sys_id]) c.sectionState[a.sys_id] = {};
        c.sectionState[a.sys_id][key] = !c.sectionState[a.sys_id][key];
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c.sectionState)); } catch (e) {}
    };

    c.isExpanded = function(a, key) {
        return !!(c.sectionState[a.sys_id] && c.sectionState[a.sys_id][key]);
    };

    // Per-assigner view: 'dashboard' (default) or 'settings'. Kept on the
    // controller so it survives the c.data replacement that server.update()
    // does. Drafts for the rename field and the add-shift form live here too,
    // keyed by assigner sys_id, for the same reason.
    c.viewState    = {};
    c.nameDrafts   = {};
    c.draftShifts  = {};
    c.confirmDelete = {};

    c.isSettingsView = function(a) { return c.viewState[a.sys_id] === 'settings'; };

    c.showSettings = function(a) {
        c.viewState[a.sys_id]    = 'settings';
        c.nameDrafts[a.sys_id]   = a.name;
        c.confirmDelete[a.sys_id] = false;
        if (!c.draftShifts[a.sys_id]) {
            c.draftShifts[a.sys_id] = { name: '', start: '09:00', end: '17:00' };
        }
    };

    c.showDashboard = function(a) {
        c.viewState[a.sys_id]     = 'dashboard';
        c.confirmDelete[a.sys_id] = false;
    };

    c.renameAssigner = function(a) {
        var name = (c.nameDrafts[a.sys_id] || '').replace(/^\s+|\s+$/g, '');
        if (!name || name === a.name) return;
        c.data.action = 'renameAssigner';
        c.data.assignerSysId = a.sys_id;
        c.data.name = name;
        c.server.update();
    };

    c.deleteAssigner = function(a) {
        c.data.action = 'deleteAssigner';
        c.data.assignerSysId = a.sys_id;
        c.server.update().then(function(response) {
            c.confirmDelete[a.sys_id] = false;
            c.viewState[a.sys_id] = 'dashboard';
            var remaining = (response && response.data && response.data.assigners)
                ? response.data.assigners.length : 0;
            c.activeTab = remaining ? 0 : -1;
        });
    };

    c.addShift = function(a) {
        var d = c.draftShifts[a.sys_id];
        if (!d || !d.name || !isValidHhmm(d.start) || !isValidHhmm(d.end)) return;
        c.data.action = 'addShift';
        c.data.assignerSysId = a.sys_id;
        c.data.name  = d.name;
        c.data.start = d.start;
        c.data.end   = d.end;
        c.server.update().then(function() {
            c.draftShifts[a.sys_id] = { name: '', start: '09:00', end: '17:00' };
        });
    };

    c.saveShift = function(a, s) {
        if (!s.name || !isValidHhmm(s.start_time) || !isValidHhmm(s.end_time)) return;
        c.data.action = 'updateShift';
        c.data.shiftSysId = s.sys_id;
        c.data.name  = s.name;
        c.data.start = s.start_time;
        c.data.end   = s.end_time;
        c.server.update();
    };

    c.deleteShift = function(a, s) {
        c.data.action = 'deleteShift';
        c.data.shiftSysId = s.sys_id;
        c.server.update();
    };

    c.addBreak = function(a, s) {
        c.data.action = 'addBreak';
        c.data.shiftSysId = s.sys_id;
        c.data.start = '12:00';
        c.data.end   = '13:00';
        c.server.update();
    };

    c.saveBreak = function(a, s, b) {
        if (!isValidHhmm(b.start_time) || !isValidHhmm(b.end_time)) return;
        c.data.action = 'updateBreak';
        c.data.breakSysId = b.sys_id;
        c.data.start = b.start_time;
        c.data.end   = b.end_time;
        c.server.update();
    };

    c.deleteBreak = function(a, s, b) {
        c.data.action = 'deleteBreak';
        c.data.breakSysId = b.sys_id;
        c.server.update();
    };

    c.draftAssigner = { name: '', groupSysId: '' };

    c.createAssigner = function() {
        var d = c.draftAssigner;
        if (!d.name || !d.groupSysId) return;
        c.data.action = 'createAssigner';
        c.data.name = d.name;
        c.data.groupSysId = d.groupSysId;
        c.server.update().then(function(response) {
            c.draftAssigner = { name: '', groupSysId: '' };
            // Jump to the newly-created assigner's tab if we can find it.
            if (response && response.data && response.data.assigners) {
                for (var i = 0; i < response.data.assigners.length; i++) {
                    if (response.data.assigners[i].name === d.name) {
                        c.activeTab = i;
                        break;
                    }
                }
            }
        });
    };

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

        // Mirror the engine's gate so the badge tracks the same idea of
        // "active window" the scheduler uses.
        var nowSec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
        if (c.data && c.data.assigners) {
            for (var i = 0; i < c.data.assigners.length; i++) {
                c.data.assigners[i].inActiveWindow = isInActiveWindow(c.data.assigners[i], nowSec);
            }
        }
    }

    function hhmmToSec(s) {
        var m = ('' + (s || '')).match(/^(\d{1,2}):(\d{2})/);
        if (!m) return null;
        return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60;
    }

    function isInActiveWindow(a, nowSec) {
        // Pure time-window check — independent of stop_overnight. The badge
        // reflects "are we inside start..end?", not "would the engine halt?".
        var startSec = hhmmToSec(a.run_start_time);
        var endSec   = hhmmToSec(a.run_end_time);
        if (startSec !== null && nowSec < startSec) return false;
        if (endSec   !== null && nowSec > endSec)   return false;
        return true;
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
                fresh[response.data.assigners[i].sys_id] = response.data.assigners[i];
            }
            for (var j = 0; j < c.data.assigners.length; j++) {
                var local = c.data.assigners[j];
                var f = fresh[local.sys_id];
                if (!f) continue;
                // Patch the few fields the engine can change behind our back —
                // not the whole assigner object, so anything the user is in
                // the middle of editing (dropdowns, time inputs) is left alone.
                local.lastRunMs       = f.lastRunMs;
                local.running         = f.running;
                local.roundRobinOrder = f.roundRobinOrder || local.roundRobinOrder;
                local.activityLog     = f.activityLog     || local.activityLog;
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

    c.captureRunTime = function(a, which) {
        // Stash the value before the user starts editing so we can revert
        // if they leave junk in the field.
        var key = a.sys_id + ':' + which;
        c._prevRunTime = c._prevRunTime || {};
        c._prevRunTime[key] = which === 'start' ? a.run_start_time : a.run_end_time;
    };

    c.setRunTime = function(a, which) {
        var s = which === 'start' ? a.run_start_time : a.run_end_time;
        if (!isValidHhmm(s)) {
            var key = a.sys_id + ':' + which;
            var prev = (c._prevRunTime || {})[key];
            if (prev !== undefined) {
                if (which === 'start') a.run_start_time = prev;
                else                   a.run_end_time   = prev;
            }
            return;
        }
        c.data.action = 'setRunTime';
        c.data.assignerSysId = a.sys_id;
        c.data.which = which;
        c.data.value = s;
        c.server.update();
    };

    function isValidHhmm(s) {
        var m = ('' + (s || '')).match(/^(\d{2}):(\d{2})$/);
        if (!m) return false;
        var hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
        return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
    }

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

    c.setReassignState = function(a, s, enabled) {
        s.enabled = enabled;
        c.data.action = 'toggleReassignState';
        c.data.assignerSysId = a.sys_id;
        c.data.tableName = s.table_name;
        c.data.stateValue = s.state_value;
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
