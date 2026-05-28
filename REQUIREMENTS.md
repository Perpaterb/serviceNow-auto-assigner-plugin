# Requirements

## 1. Access & multi-tenancy

- **R1.1** The app must define a scoped role `x_1578378_aa.queue_manager` (the
  app's own namespaced role — chosen to avoid clashing with any existing
  `queue_manager` on the target instance, per Q12).
- **R1.2** A user who holds `x_1578378_aa.queue_manager` AND is a member of an
  assignment group may create and configure auto-assigners for that group only.
- **R1.3** Any member of an assignment group can see a **stripped read-only
  summary** of the auto-assigner(s) configured for that group — status
  (running/stopped) and the current roster (Working / Not-working lists with
  shift names). No edit affordances. The full Main / Shift-setup pages
  remain restricted to `x_1578378_aa.queue_manager`.
- **R1.4** Multiple auto-assigners may run concurrently on the same assignment
  group.

## 2. Auto-assigner lifecycle & UI shell

- **R2.1** Auto-assigners appear as tabs. A `+` to the right of the last tab
  adds a new one.
- **R2.2** Creating an auto-assigner requires choosing an assignment group
  (restricted to groups the manager belongs to) and a name.
- **R2.3** Each auto-assigner has two pages/tabs: **Main** and **Shift setup**.

## 3. Shift setup page

- **R3.1** Managers define shift templates: name, start time, end time, and
  zero or more breaks (each break = start + end).
- **R3.2** A shift may have no break, one break, or multiple breaks.
- **R3.3** A built-in **Default** shift exists: 09:00 start, 17:00 end, break
  12:30–13:30. The default is editable and renameable like any other shift.
- **R3.4** Shifts are **scoped to a single auto-assigner** (not shared across
  assigners). They can be created, edited, renamed, and deleted **only while
  the auto-assigner is stopped** — Start must be toggled off first. Deletion
  of a shift in use reassigns its analysts to the Default shift on the same
  assigner.

## 4. Main page — roster

- **R4.1** Start/Stop button and a live "currently running" status indicator.
- **R4.2** Two lists — **Working** and **Not working** — together containing
  exactly the active members of the assignment group (no one else).
- **R4.3** An analyst can be moved between the two lists at any time, including
  mid-day (covers calling in sick).
- **R4.4** Each analyst in the Working list shows a shift-selection dropdown
  listing all shifts from Shift setup for this assigner.
- **R4.5** State is persisted: all settings and list membership survive reloads
  and restarts.
- **R4.6** Each analyst remembers the **last shift assigned to them** (used to
  pre-select the dropdown next time).
- **R4.7** Members removed from the underlying assignment group are
  **soft-deactivated** on the roster — their `roster_entry` is kept (preserving
  `last_assigned_at` and last-shift memory) but marked inactive so they're
  skipped during distribution. If they rejoin the group, reactivate.

## 5. Main page — run window

- **R5.1** Assigner **start time** and **end time** of day. The assigner may be
  switched on yet not assign until the start time is reached.
- **R5.2** A **"Stop running overnight"** checkbox. When ticked, the assigner
  halts at the daily `end_time` (hard daily cutoff — no carry across midnight).
  When unticked, the daily end is not enforced and the assigner continues
  while `running = true`.

## 6. Main page — ticket selection

- **R6.1** A section listing **ticket types** to look for, with a checkbox per
  type. The selectable list is **auto-derived** at runtime from descendants of
  the `task` table that have an `assignment_group` field. Per-assigner
  enabled/disabled state is stored in `ticket_type_selection`.
- **R6.2** Only **unassigned** tickets of the checked types are picked up.

## 7. Main page — reassignment of responded tickets

- **R7.1** A master checkbox: **"Unassign tickets for not-working analysts."**
  When ticked, three eligibility checkboxes appear plus a second ticket-type
  list. The eligibility checkboxes are independent (a ticket qualifies if it
  matches **any** ticked box):
  - **In Progress** — ticket is currently in state In Progress.
  - **New** — ticket is currently in state New.
  - **On Hold → In Progress** — ticket transitioned from On Hold back to In
    Progress (proxy for "user responded").
- **R7.2** When enabled: a ticket currently assigned to a **not-working**
  analyst that matches the eligibility above is unassigned (set
  `assigned_to` empty) so it returns to the pool. Freed tickets are **not**
  redistributed in the same cycle — they are picked up by the next scheduled
  run like any other unassigned ticket.

## 8. Main page — activity log

- **R8.1** An activities list showing ticket number, action (assigned /
  unassigned), and timestamp.
- **R8.2** Entries auto-clear after 7 days.

## 9. Assignment engine behaviour

- **R9.1** Strategy: round-robin / last-assigned among **eligible** analysts.
- **R9.2** Current ticket count of an analyst is ignored.
- **R9.3** Eligible = roster `active = true` AND in Working list AND now
  within shift AND not within a break AND within the assigner run window.
- **R9.4** Analysts on a not-yet-started shift, on a break, off-shift, or
  inactive (removed from group) are skipped.
- **R9.5** The rotation pointer / last-assigned timestamp is per auto-assigner.
- **R9.6** When several unassigned tickets are distributed in one cycle, they
  are processed **oldest first** by `sys_created_on`.
- **R9.7** Catch-up flooding is accepted: a newly-eligible analyst with an old
  `last_assigned_at` may receive several tickets in a row until they catch up.
- **R9.8** Assignment writes **only** `assigned_to`. The engine does not change
  ticket state and does not write a work note.

## Non-functional

- **NF1** Engine cadence configurable (e.g. every 1–5 min via Scheduled Job).
- **NF2** All auto-assign actions must be auditable via the activity log.
- **NF3** No external network calls — fully in-platform.
- **NF4** Front-end is built on **Service Portal** — no App Engine tier
  dependency required for the UI.
- **NF5** Concurrency-safe: all auto-assigners run **sequentially inside one
  Scheduled Job**, so two assigners on one group cannot double-assign the same
  ticket in a cycle.
- **NF6** All shift, break, and run-window times are interpreted in the
  **ServiceNow instance timezone**. No per-assigner or per-user TZ.
