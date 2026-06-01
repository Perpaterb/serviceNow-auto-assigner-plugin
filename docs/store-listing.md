# Store Listing Copy

Draft text for the ServiceNow Store listing. Paste these fields into the
publishing portal when you submit the app, and upload the matching screenshots
from [screenshots/](screenshots/). Trim to fit each field's character limit.

---

## App name

ServiceNow Auto-Assigner

## Short summary (one line)

Fairly distribute unassigned tickets across a group's available analysts —
automatically, on a schedule, with shifts and round-robin balancing.

## Long description

ServiceNow Auto-Assigner is a scoped application that takes the manual triage
out of shared queues. Point it at a ServiceNow assignment group, mark who's
working, and it hands each new unassigned ticket to the next available analyst
in turn — evenly, around the clock or only during the hours you choose. It
installs straight into your ServiceNow instance with no external dependencies.

It understands real teams: analysts work **shifts** with **breaks**, the assigner
runs inside an **active window**, and only people who are on shift right now
receive work. Distribution is **round-robin** (least-recently-assigned goes
next), so the load is shared without anyone needing to watch the queue. Oldest
tickets are handed out first.

Managers get a clean Service Portal page with a tab per assigner: start/stop,
live status and a next-run countdown, a working roster, ticket-type selection,
an optional rule to pull tickets back from analysts who've stepped away, and an
activity log of everything assigned today. Everyone else on the team gets a
tidy read-only view.

**Highlights**

- Round-robin assignment across a group's available analysts
- Multiple independent assigners per group (e.g. day vs. night)
- Shifts with breaks, and per-day active-window (working-hours) control
- "Stop overnight" option for weekends and holidays
- Choose exactly which ticket types are covered
- Optional auto-unassign of tickets held by not-working analysts
- Activity log of today's assignments and unassignments
- Role-based access: managers configure, everyone else reads
- Works with any ServiceNow task-based table (Incident, Request, Change, HR, CSM, and more)
- Native scoped ServiceNow app — runs entirely on-platform, no external services

## Key features (bullets for the feature list)

- Automatic, scheduled round-robin ticket distribution
- Shift and break scheduling per analyst
- Active-window / working-hours gating
- Per-group, multi-assigner configuration
- Configurable ticket types and reassignment states
- Read-only team view and manager controls
- Activity log

## Categories / tags

ITSM, Task Management, Workforce / Queue Management, Productivity

## Requirements & compatibility

- ServiceNow platform: _(fill in the minimum release you've tested, e.g. Xanadu+)_
- No external dependencies; self-contained scoped application.

## Roles

- `x_1578378_aa.queue_manager` — configure and run assigners for groups the user
  belongs to. (System administrators have full access.)

## Setup notes

After install, grant the `x_1578378_aa.queue_manager` role to your queue
managers and ensure they're members of the relevant assignment groups. See the
[User Guide](user-guide.md) for day-to-day use.

## Support

- Documentation: _(link to your published docs site, e.g. GitHub Pages URL)_
- Support contact: _(your support email / portal)_

## Version / release notes

_(Summarise what's in this release — paste your changelog here at publish time.)_
