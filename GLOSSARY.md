# Glossary

| Term | Meaning |
|------|---------|
| **Scoped app** | A self-contained ServiceNow application with its own scope prefix (`x_...`), tables, UI, logic, and security. The proper term for what is informally called a "plugin". |
| **Auto-assigner** | A single configured instance of the assignment engine, bound to one assignment group. A group can have multiple auto-assigners running. Shown as a tab in the UI. |
| **Analyst** | A fulfiller who receives tickets. A member of the assignment group. (Previously called "agent".) |
| **Queue manager** | The role that can create, configure, start/stop, and manage auto-assigners. Implemented as the scoped role `x_1578378_aa.queue_manager` to avoid colliding with any pre-existing role of the same informal name. |
| **Assignment group** | Standard ServiceNow `sys_user_group`. Analysts are its members. |
| **Shift** | A named template of start time, end time, and zero or more breaks. **Scoped to a single auto-assigner** — not shared across assigners. Reusable across analysts on that one assigner. |
| **Roster (working list)** | The set of analysts currently designated to work today, each with a chosen shift. |
| **Working / not working list** | Two UI lists on the main page partitioning the group's **active** members. Ex-members are soft-deactivated and hidden from these lists. |
| **Round-robin / Last-assigned** | Rotation strategy: the next ticket goes to the eligible analyst who has gone longest without an assignment. Ignores current ticket count. |
| **Eligible (working now)** | An analyst whose roster entry is active, who is in the working list, AND the current time (instance TZ) is inside their shift AND not inside one of their breaks. |
| **Assigner run window** | The daily start/end time during which the auto-assigner actually assigns (distinct from the engine being switched on). |
| **Activity log** | Per-assigner record of actions (assigned / unassigned) with ticket number and timestamp. Auto-purged after 7 days. |
