// Auto-Assigner activity-log purge.
//
// Runs daily. Deletes x_1578378_aa_activity_log rows older than 7 days
// (R8.2). Idempotent — runs against the current set every cycle.
//
// Scope: x_1578378_aa
(function execute() {
    var SCOPE = 'x_1578378_aa_';
    var TAG = '[' + SCOPE + 'purge]';

    var cutoff = new GlideDateTime();
    cutoff.addDaysLocalTime(-7);

    var log = new GlideRecord(SCOPE + 'activity_log');
    log.addQuery('sys_created_on', '<', cutoff);
    log.query();
    var n = log.getRowCount();
    if (n > 0) {
        log.deleteMultiple();
        gs.info(TAG + ' deleted ' + n + ' activity_log row(s) older than ' + cutoff.getDisplayValue());
    }
})();
