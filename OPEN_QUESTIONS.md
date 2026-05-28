# Open Questions

These were the genuine ambiguities in the spec. All resolved — recorded here
so the build can proceed without guessing. Downstream docs
(REQUIREMENTS, DATA_MODEL, ARCHITECTURE) should be reconciled to these.

### Q1 — Non-manager visibility
R1.3 says group members can *see* their group's auto-assigner. Should that be:
- (a) read-only view of the Main/Shift pages, or
- (b) hidden entirely from non-managers, or
- (c) a stripped read-only summary (status + roster only)?

**Decision:** (c) stripped read-only summary — status + roster only.

### Q2 — Editing/deleting shifts
**Decision:** shifts cannot be edited (or deleted) while the auto-assigner is
running — the assigner must be stopped first. Shifts are **per-assigner**,
not shared globally, so deleting a shift only affects its own assigner's
roster.

### Q3 — "Stop running overnight" vs the run window
**Decision:** the overnight checkbox simply means "when the daily `end_time`
is reached, the assigner stops running." It is the hard daily cutoff. (No
cross-midnight carry-over behaviour.)

### Q4 — Source of the ticket-type list
**Decision:** auto-derive from `task` descendants — tables extending `task`
that have an `assignment_group` field. Enabled ones are stored in
`ticket_type_selection`.

### Q5 — Eligibility to pull a ticket back from a not-working analyst
There is no built-in "user responded" state in ServiceNow, so eligibility is
configured per assigner via **three independent checkboxes**:
- **In Progress** — pull back tickets currently in In Progress.
- **New** — pull back tickets still in New.
- **On Hold → In Progress** — pull back tickets that transitioned from On
  Hold back to In Progress (treated as the proxy for "user responded").

A ticket is eligible if it matches **any** ticked box.

### Q5b — Redistribution timing
**Decision:** when a ticket is pulled back, it is **not** redistributed in
the same cycle. The next scheduled run picks it up like any other unassigned
ticket.

### Q6 — Timezone
**Decision:** all shift/break/window times are interpreted in the
**ServiceNow instance timezone**. No per-assigner or per-user TZ override.

### Q7 — Concurrency between multiple assigners on one group
**Decision:** all assigners are processed **sequentially inside one
Scheduled Job** so no two assigners can grab the same ticket. No parallel
execution.

### Q8 — Ordering of unassigned tickets for distribution
**Decision:** **oldest created first** (FIFO by `sys_created_on`).

### Q9 — Catch-up behaviour for newly-eligible analysts
**Decision:** **accept it** — true round-robin. An analyst with an old
`last_assigned_at` may receive several tickets in a row until they catch up.
Revisit only if managers complain.

### Q10 — Removed group members
**Decision:** **soft-deactivate** the roster entry. Keep the row (and its
`last_assigned_at` history); mark inactive so it's skipped during
distribution. Re-activate if they return.

### Q11 — UI framework
**Decision:** **Service Portal**.

### Q12 — `queue_manager` role naming
**Decision:** **namespace it** as `x_..._queue_manager` (scoped-app prefix)
to avoid any clash with existing roles on the target instance.

### Q13 — What "assign" writes to the ticket
**Decision:** **set `assigned_to` only**. Do not change state, do not write
a work note.
