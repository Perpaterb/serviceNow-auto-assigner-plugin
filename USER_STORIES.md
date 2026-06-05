# User Stories

Stories are grouped into epics. Each has acceptance criteria (AC). "Manager"
means a user with the scoped `x_1578378_aa.queue_manager` role; "analyst" means
an assignment-group member.

---

## Epic A — Access & visibility

### A1 — Queue manager role exists
**As** a platform admin
**I want** the app to provide a scoped `x_1578378_aa.queue_manager` role
**So that** the right people can configure auto-assigners.
- AC1: On install, the scoped role exists in the app scope (namespaced to
  avoid clashing with any existing `queue_manager` role on the instance).
- AC2: The role can be granted to users like any other ServiceNow role.

### A2 — See auto-assigners for my groups
**As** an analyst in an assignment group
**I want** to see the auto-assigner(s) configured for my group
**So that** I have visibility into how my work is distributed.
- AC1: Opening the app shows only auto-assigners for groups I belong to.
- AC2: Without `x_1578378_aa.queue_manager`, I see a **stripped read-only
  view** — the assigner tabs, status (running/stopped), the current roster
  (Working / Not-working with shift names), and today's activity log — and no
  edit affordances (no Start/Stop, no settings, no create tab).

### A3 — Configure only my groups
**As** a manager
**I want** to create/edit auto-assigners only for groups I'm a member of
**So that** I can't affect other teams' queues.
- AC1: The group picker when creating an assigner lists only my groups.
- AC2: I cannot open another group's assigner config by URL/ID manipulation
  (enforced by ACL, not just UI).

---

## Epic B — Auto-assigner shell

### B1 — Create an auto-assigner
**As** a manager
**I want** to add a named auto-assigner for one of my groups
**So that** I can run distribution for that queue.
- AC1: A `+` to the right of the last tab opens a create flow.
- AC2: I supply a name and pick an eligible group.
- AC3: The new assigner appears as a new tab.

### B2 — Multiple assigners per group
**As** a manager
**I want** more than one auto-assigner on the same group
**So that** I can split distribution by different rules.
- AC1: Creating a second assigner on a group already covered is allowed.
- AC2: The two run independently with separate config and rotation state.

### B3 — Two views per assigner
**As** a manager
**I want** each assigner to have a Main view and a Shifts & settings view
**So that** everyday roster control is separate from configuration.
- AC1: Each assigner exposes a Main view (status, roster, run window, ticket
  types, reassign, activity) and a Shifts & settings view reached from the
  header.
- AC2: Shifts & settings holds shift/break management plus assigner-level
  settings (rename, tab colour, delete).

### B4 — Rename an auto-assigner
**As** a manager
**I want** to rename an assigner from its settings
**So that** the tab label reflects what it's for.
- AC1: A name field on Shifts & settings updates the assigner's name on save.
- AC2: The tab heading reflects the new name.

### B5 — Delete an auto-assigner
**As** a manager
**I want** to delete an assigner I no longer need
**So that** stale assigners don't clutter the tabs.
- AC1: Delete requires an explicit in-place confirmation before it happens.
- AC2: Deleting removes the assigner and everything tied to it — its shifts and
  breaks, roster entries, ticket-type / reassign-type / reassign-state
  selections, and activity log.
- AC3: After deletion the view falls back to another assigner (or the create
  tab if none remain).

### B6 — Colour-code a tab
**As** a manager
**I want** to tint an assigner's tab and panel with a pastel colour
**So that** I can tell multiple assigners apart at a glance.
- AC1: A colour picker offers a fixed pastel palette plus a "no colour" option.
- AC2: The choice tints both the tab label and the assigner panel, and persists.

---

## Epic C — Shift setup

### C1 — Define shifts
**As** a manager
**I want** to create shift templates with start, end, and breaks
**So that** I can model how my team works.
- AC1: A shift has a name, start time, end time.
- AC2: A shift can have zero, one, or multiple breaks (each start + end).
- AC2a: Shift and break times are entered as 24-hour **HH:MM** (bare `HHMM`
  normalized; invalid input reverts), and edits save automatically.
- AC3: Shifts are reusable across analysts **on this assigner only** — shifts
  are scoped to one auto-assigner and not shared globally.
- AC4: Shift create / edit / delete is only permitted while the assigner is
  stopped.

### C2 — Default shift
**As** a manager
**I want** a ready-made Default shift (09:00–17:00, break 12:30–13:30)
**So that** I can start fast.
- AC1: The Default shift exists on a new assigner.
- AC2: It can be edited and renamed like any other shift.

### C3 — Edit / rename shifts
**As** a manager
**I want** to edit and rename any shift
**So that** I can adjust to changing patterns.
- AC1: Any shift (incl. Default) can be edited and renamed while the assigner
  is stopped.
- AC2: Edit / rename / delete actions are blocked while the assigner is
  running; the UI surfaces this clearly.
- AC3: Deleting a shift currently selected by roster entries reassigns those
  entries to the assigner's Default shift.

---

## Epic D — Roster (Main page)

### D1 — Working / not-working lists
**As** a manager
**I want** two lists splitting my group's members
**So that** I control who's in play today.
- AC1: Both lists together = exactly the group's members.
- AC2: No non-members appear.

### D2 — Move analysts between lists
**As** a manager
**I want** to move an analyst between Working and Not working at any time
**So that** I can handle sick calls and late starts mid-day.
- AC1: A move takes effect on the next engine cycle.
- AC2: Moving someone to Not working stops them receiving new tickets.

### D3 — Assign shift per working analyst
**As** a manager
**I want** a shift dropdown next to each working analyst
**So that** each person runs on the right hours.
- AC1: The dropdown lists all shifts from Shift setup.
- AC2: The selection persists.

### D4 — Remember last shift per analyst
**As** a manager
**I want** each analyst to default to the shift they last had
**So that** daily setup is faster.
- AC1: When an analyst is added to Working, their dropdown pre-selects their
  last assigned shift (if any).

---

## Epic E — Run control & window

### E1 — Start / stop & status
**As** a manager
**I want** a start/stop button and a live running status
**So that** I know and control whether the assigner is active.
- AC1: Status clearly shows running vs stopped.
- AC2: Stopping halts all assignment immediately.
- AC3: While running, a live "next run in …" countdown to the next engine
  cycle is shown, driven by the scheduled job's real next-fire time.

### E2 — Daily run window
**As** a manager
**I want** an assigner start time and end time of day
**So that** it only assigns during chosen hours even if switched on earlier.
- AC1: With the assigner on but before start time, no tickets are assigned.
- AC2: After end time, no further tickets are assigned that day.
- AC3: Times are entered as 24-hour **HH:MM**; a bare `HHMM` is normalized
  (`0900` → `09:00`, `2400` → `00:00`) and anything invalid reverts to the
  previous value.

### E3 — Stop running overnight
**As** a manager
**I want** a "stop running overnight" checkbox
**So that** assignment halts at the daily end time.
- AC1: When ticked, the assigner stops at `end_time` each day — no assignment
  past that point until `start_time` the next day.
- AC2: When unticked, `end_time` is not enforced and assignment continues
  while the assigner is running.

---

## Epic F — Ticket selection

### F1 — Choose ticket types
**As** a manager
**I want** checkboxes for ticket types (INC, RITM, REQ, …)
**So that** the assigner only handles the queues I want.
- AC1: The type list is **auto-derived** at runtime from descendants of the
  `task` table that have an `assignment_group` field.
- AC2: Only checked types are picked up.

### F2 — Only unassigned tickets
**As** a manager
**I want** only unassigned tickets distributed
**So that** existing work isn't disturbed.
- AC1: A ticket with an assignee is not picked up by normal assignment.

---

## Epic G — Reassign responded tickets

### G1 — Unassign responded tickets from not-working analysts
**As** a manager
**I want** an option to free up tickets that a not-working analyst has, based
on the ticket's current state
**So that** customer replies aren't stuck with someone who's off.
- AC1: A master checkbox enables this behaviour.
- AC2: When enabled, a second ticket-type list appears (governs which types
  this applies to) plus three independent eligibility checkboxes:
  **In Progress**, **New**, **On Hold → In Progress** (most recent state
  transition was On Hold → In Progress — proxy for "user responded").
- AC3: A ticket qualifies if it's assigned to a not-working analyst, its
  table is in the second list, AND it matches **any** ticked eligibility flag.
- AC4: Qualifying tickets are unassigned (`assigned_to` cleared) and returned
  to the pool. They are **not** redistributed in the same cycle — the next
  scheduled run picks them up like any other unassigned ticket.

---

## Epic H — Activity log

### H1 — See what the assigner did
**As** a manager
**I want** a log of actions with ticket number, action, and timestamp
**So that** I can audit and troubleshoot distribution.
- AC1: Each assign and unassign creates a log entry.
- AC2: Entries show ticket number, action, timestamp.

### H2 — Auto-purge after 7 days
**As** a manager
**I want** the log to clear entries older than 7 days
**So that** it stays relevant and small.
- AC1: Entries older than 7 days are removed automatically.

---

## Epic I — Assignment engine

### I1 — Round-robin among eligible analysts
**As** a manager
**I want** even rotation ignoring current ticket count
**So that** distribution is fair by turn, not by load.
- AC1: Next ticket goes to the eligible analyst longest without an assignment.
- AC2: Current ticket count does not affect selection.

### I2 — Respect shifts and breaks
**As** a manager
**I want** off-shift, not-yet-started, and on-break analysts skipped
**So that** only people actually working receive tickets.
- AC1: An analyst before their shift start gets nothing.
- AC2: An analyst during a break gets nothing.
- AC3: An analyst after their shift end gets nothing.

### I3 — No double assignment
**As** a manager
**I want** safe behaviour when multiple assigners run on one group
**So that** a ticket isn't assigned twice in one cycle.
- AC1: All assigners run **sequentially inside one Scheduled Job**, so no two
  are active at the same instant and a ticket assigned by one cannot be
  re-picked by another in the same cycle.

### I4 — See who's next
**As** a manager
**I want** to see the current round-robin order
**So that** I can predict and verify how the next tickets will be shared.
- AC1: A panel lists the currently-eligible analysts in next-up order.
- AC2: Each entry shows the analyst's shift and when they were last assigned.
