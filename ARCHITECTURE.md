# Architecture

## Components

1. **Custom tables** (see DATA_MODEL.md) — config + state + audit.
2. **Manager UI** — **Service Portal** widgets (Q11). Tabbed shell, Main page,
   Shift setup page. A stripped read-only summary widget for non-managers
   (R1.3).
3. **Assignment engine** — a single Scheduled Job (Script) that runs every N
   minutes and processes every `running` assigner **sequentially**.
4. **Purge job** — a Scheduled Job that clears `activity_log` > 7 days old.
5. **Security** — `x_<scope>_queue_manager` role + ACLs scoped by group
   membership.

## Engine cycle (per running assigner)

Runs every N minutes (NF1). One Scheduled Job iterates over every `assigner`
with `running = true`, in series — so no two assigners on the same group can
race for a ticket (NF5 / Q7).

```
1. Gate on time window (R5.1 / R5.2):
   now = current time in INSTANCE TZ
   if now < run_start_time: skip assigner
   if stop_overnight and now > run_end_time: skip assigner
   (if stop_overnight is false, end_time is not enforced)

2. Reconcile roster:
   - For each current member of assignment_group with no roster_entry: insert
     one (active = true, working = false).
   - For each existing roster_entry whose analyst is no longer in the group:
     set active = false (soft — keep last_assigned_at / last_shift). If they
     return, flip active back to true. (R4.7 / Q10)

3. Build eligible analyst list:
   eligible = roster_entry where
     active = true AND working = true
     AND now within shift.start..shift.end
     AND now NOT within any shift_break of that shift
   order eligible by last_assigned_at ASC (nulls first), tiebreak by sys_id

4. Collect unassigned work:
   for each enabled type in ticket_type_selection:
     find records on that table where
       assignment_group = this group AND assigned_to is empty
   sort tickets by sys_created_on ASC (R9.6 — oldest first)

5. Distribute round-robin:
   for each ticket:
     if eligible is empty: break
     pick the eligible analyst with the oldest last_assigned_at
     set ticket.assigned_to = analyst    -- ONLY assigned_to (R9.8)
                                         -- no state change, no work note
     set roster_entry.last_assigned_at = now
     set roster_entry.last_shift = current shift (R4.6)
     log 'assigned'
     re-sort so the next ticket goes to the next analyst

6. Reassign responded tickets (R7) — done AFTER distribution so freed tickets
   are picked up on the NEXT cycle, not this one (R7.2 / Q5b):
   if reassign_responded:
     for each enabled type in reassign_type_selection:
       find tickets on that table where
         assignment_group = this group
         AND assigned_to is a NOT-working analyst (active or not)
         AND the ticket matches ANY ticked eligibility flag:
           - reassign_state_in_progress  AND state = In Progress, OR
           - reassign_state_new          AND state = New, OR
           - reassign_state_onhold_to_inprogress AND most recent state
             transition was On Hold → In Progress
       set assigned_to = empty
       log 'unassigned'
```

## Round-robin definition

- The "next" analyst is always the eligible one whose `last_assigned_at` is
  oldest. After assigning, that timestamp updates to now, pushing them to the
  back. This yields even rotation independent of how many tickets each holds
  (R9.2) and survives restarts because state is in the table (R4.5).
- Catch-up flooding is accepted (R9.7): a newly-eligible analyst with an old
  `last_assigned_at` will receive several tickets in a row until they catch up.

## Concurrency & double-assignment (NF5 / Q7)

**Decision: sequential single-job.** One Scheduled Job iterates over every
`running` assigner in series. Within a cycle no two assigners are active at
the same instant, so two assigners on one group cannot race for an
unassigned ticket. No claim flag, no optimistic-update guard needed at this
stage.

## Roster reconciliation (R4.7 / Q10)

Group membership (`sys_user_grmember`) changes over time. On each engine
cycle (and ideally also via a business rule on membership change):
- Add `roster_entry` for new members (defaults: `active = true`,
  `working = false`).
- For removed members: flip `active = false` (soft). Preserves
  `last_assigned_at` / `last_shift` so re-joiners pick up where they left
  off.

## Timezone (NF6 / Q6)

All shift times, breaks, and run windows are interpreted in the **ServiceNow
instance timezone**. There is no per-assigner or per-user override. The
engine compares "now in instance TZ" against the stored Time fields directly.

## Security model

- `x_<scope>_queue_manager` role: create/edit/delete assigners, shifts,
  roster, config; Start/Stop.
- ACLs additionally constrain write to assigners whose `assignment_group` is
  one the user is a member of (group-membership check in the ACL script).
- Group members **without** `x_<scope>_queue_manager` get a **read-only
  stripped summary** widget — status (running/stopped) + roster (Working /
  Not-working with shift names). No other Main / Shift-setup affordances
  (R1.3).
- Shift create / edit / delete is additionally gated on `assigner.running =
  false` (R3.4) — enforced via ACL + UI affordance.
- The engine runs as a system/scheduled context, so it can assign regardless
  of the manager's individual rights — but it only acts on configured groups.

## Scheduling

- Engine job cadence: configurable system property (default 1–5 min).
- Purge job: daily.
- Both are app-scoped Scheduled Jobs shipped with the app.

## Build order (suggested)

1. App scope + tables + `x_<scope>_queue_manager` role + ACLs.
2. Seed logic: Default shift on assigner creation.
3. Engine script (steps 1–6) with logging — testable headless before UI.
4. Purge job.
5. Service Portal UI: tabs + `+`, then Shift setup page, then Main page,
   then the stripped read-only summary widget for non-managers.
6. Reassign-responded feature (R7) last.
