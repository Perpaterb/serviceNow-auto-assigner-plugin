// After-insert business rule on x_1578378_aa_assigner.
//
// Seeds the built-in Default shift (09:00–17:00 with break 12:30–13:30,
// per R3.3) on every newly-created assigner so managers don't have to
// build it by hand.
(function executeRule(current, previous /*null when async*/) {
    var SCOPE = 'x_1578378_aa_';

    var shift = new GlideRecord(SCOPE + 'shift');
    shift.initialize();
    shift.assigner   = current.sys_id;
    shift.name       = 'Default';
    shift.start_time = '09:00:00';
    shift.end_time   = '17:00:00';
    shift.is_default = true;
    var shiftSysId = shift.insert();
    if (!shiftSysId) {
        gs.warn('[x_1578378_aa seed] could not insert Default shift for assigner ' + current.sys_id);
        return;
    }

    var br = new GlideRecord(SCOPE + 'shift_break');
    br.initialize();
    br.shift      = shiftSysId;
    br.start_time = '12:30:00';
    br.end_time   = '13:30:00';
    br.insert();
})(current, previous);
