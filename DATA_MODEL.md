# Data Model

All tables live in the app scope (`x_1578378_aa` — set on app
creation). Names below omit the scope prefix for readability.

## Tables

### `assigner`
One row per auto-assigner (one tab in the UI).
| Field | Type | Notes |
|-------|------|-------|
| name | String | Display name / tab label |
| assignment_group | Reference → `sys_user_group` | The group it serves |
| running | True/False | Master on/off (the Start/Stop state) |
| run_start_time | Time | Daily window start (R5.1) |
| run_end_time | Time | Daily window end (R5.1) |
| stop_overnight | True/False | When true, halt at `run_end_time` (R5.2) |
| reassign_responded | True/False | Master toggle for R7 |
| reassign_state_in_progress | True/False | R7.1 — eligibility: In Progress |
| reassign_state_new | True/False | R7.1 — eligibility: New |
| reassign_state_onhold_to_inprogress | True/False | R7.1 — eligibility: transitioned On Hold → In Progress |
| last_run | Date/Time | Diagnostics |

> Timezone is **not** stored per assigner — all times are interpreted in the
> ServiceNow instance timezone (NF6).

### `shift`
Shift templates, scoped to one assigner (shifts are **not** shared across
assigners).
| Field | Type | Notes |
|-------|------|-------|
| assigner | Reference → `assigner` | Owner |
| name | String | e.g. "Default", "Early" |
| start_time | Time | |
| end_time | Time | |
| is_default | True/False | Marks the seeded Default shift |

### `shift_break`
Zero-or-more breaks per shift (supports multiple breaks).
| Field | Type | Notes |
|-------|------|-------|
| shift | Reference → `shift` | Owner |
| start_time | Time | |
| end_time | Time | |

### `roster_entry`
One row per analyst per assigner — captures working state + chosen shift.
| Field | Type | Notes |
|-------|------|-------|
| assigner | Reference → `assigner` | Owner |
| analyst | Reference → `sys_user` | Member (or ex-member) of the group |
| active | True/False | False = soft-deactivated (left the group); skip during distribution but keep the row for history (R4.7 / Q10) |
| working | True/False | Working list vs Not-working list |
| shift | Reference → `shift` | Selected shift (when working) |
| last_assigned_at | Date/Time | Drives round-robin (longest-ago wins) |
| last_shift | Reference → `shift` | Remembered for next-time pre-select (R4.6) |

> Round-robin pointer is derived from `last_assigned_at` across eligible
> (active + working + on-shift) roster entries — no separate pointer field
> needed. Ties broken by sys_id or name for determinism.

### `ticket_type_selection`
Which ticket types this assigner picks up (normal assignment). The list of
candidate `table_name` values is auto-derived from descendants of `task` that
have an `assignment_group` field (R6.1).
| Field | Type | Notes |
|-------|------|-------|
| assigner | Reference → `assigner` | Owner |
| table_name | String | e.g. `incident`, `sc_req_item`, `sc_request` |
| enabled | True/False | Checkbox state |

### `reassign_type_selection`
Second ticket-type list, only relevant when `reassign_responded` is on (R7).
Same shape as `ticket_type_selection`. Kept separate so the two lists are
independent.

### `activity_log`
| Field | Type | Notes |
|-------|------|-------|
| assigner | Reference → `assigner` | Owner |
| ticket_table | String | Source table |
| ticket_number | String | e.g. INC0012345 |
| ticket_ref | Document ID / reference | Link back to the record |
| action | Choice | assigned / unassigned |
| analyst | Reference → `sys_user` | Who it was assigned to / taken from |
| sequence | Integer | Per-cycle counter; tie-breaks rows sharing one `sys_created_on` second so the log reads in true assignment order |
| created | Date/Time | Standard sys_created_on is fine |

> Auto-purge: a Scheduled Job (or table rotation / TPP) deletes entries older
> than 7 days.

## Relationships (summary)

```
sys_user_group ──< assigner ──< shift ──< shift_break
                        │
                        ├──< roster_entry >── sys_user
                        ├──< ticket_type_selection
                        ├──< reassign_type_selection
                        └──< activity_log
```

## Key constraints

- A `roster_entry.analyst` must have been a member of
  `assigner.assignment_group` at some point. Current group membership drives
  `active`: members → `active = true`; ex-members → `active = false` (soft).
  Reconciliation runs each cycle (see ARCHITECTURE).
- Deleting an `assigner` cascades to its shifts, breaks, roster, selections,
  and logs.
- `shift` create / edit / delete is permitted **only while the owning
  `assigner.running = false`** (R3.4). Deleting a shift in use reassigns its
  roster entries to the assigner's Default shift.
