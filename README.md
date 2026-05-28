# Auto-Assigner (ServiceNow Scoped Application)

A ServiceNow scoped application that lets queue managers run configurable,
schedule-aware, round-robin assignment of unassigned tickets to analysts in
an assignment group — with a friendly interface for daily roster management,
shift setup, and mid-day changes (e.g. an analyst calling in sick).

This is a deliberate, supported alternative to Advanced Work Assignment (AWA).
AWA routes on real-time *presence* state, not on a daily *shift roster*, and
offers no manager-friendly screen for "set up today's analysts and shifts, and
pull someone off at lunchtime." Auto-Assigner fills exactly that gap.

---

## What it does

- A queue manager opens the Auto-Assigner interface and creates one or more
  **auto-assigners**, each bound to an assignment group they belong to.
- Each auto-assigner cycles **unassigned tickets** of chosen types (INC, RITM,
  REQ, etc.) to **analysts who are "working" right now** — i.e. on an active
  shift and not on a break — using a **round-robin / last-assigned** rotation.
- Ticket count held by an analyst is intentionally ignored. Pure rotation.
- Off-shift analysts, on-break analysts, and analysts on a not-yet-started
  shift never receive tickets.

## Why a scoped app (not AWA, not an external tool)

- Runs natively on the instance — no integration user, no API auth layer, no
  network round-trips. Logic runs next to the data.
- Governed by ServiceNow security, update sets, and the dev → test → prod
  lifecycle, which platform teams trust.
- Fully custom manager UI, built exactly to the queue manager's workflow.

## High-level architecture

| Layer            | Implementation                                                     |
|------------------|-------------------------------------------------------------------|
| Data             | Custom tables (assigner config, shift templates, roster, activity)|
| Manager UI       | Service Portal widgets (tabbed shell, Main page, Shift setup)      |
| Assignment engine| Single Scheduled Job (every N min) — processes assigners sequentially |
| Security         | Scoped `x_1578378_aa.queue_manager` role + group-membership ACLs       |

> **Note on the scope prefix.** The `x_1578378_` prefix is the vendor prefix
> assigned to the current Personal Developer Instance and is **locked at app
> creation**. The app's suffix is `aa`, so the full scope is `x_1578378_aa`.
> If this app is ever published to a different instance (a paying customer
> sub-prod, for example), the prefix changes to that org's vendor prefix and
> every `x_1578378_aa` reference in the codebase will need a one-shot
> find-replace to the new value. The suffix `aa` stays.

## Repo layout

```
auto-assigner/
├── README.md                  ← this file
├── docs/
│   ├── REQUIREMENTS.md        ← functional + non-functional requirements
│   ├── USER_STORIES.md        ← epics and stories with acceptance criteria
│   ├── DATA_MODEL.md          ← tables, fields, relationships
│   ├── ARCHITECTURE.md        ← engine logic, scheduling, security model
│   ├── OPEN_QUESTIONS.md      ← decisions needed before/while building
│   └── GLOSSARY.md            ← shared terminology
└── (source added as the scoped app is built)
```

## Getting started (with Claude in the terminal)

1. Read `docs/OPEN_QUESTIONS.md` first and resolve the blocking decisions.
2. Work through `docs/USER_STORIES.md` epic by epic.
3. Use `docs/DATA_MODEL.md` and `docs/ARCHITECTURE.md` as the build contract.

## Status

Pre-build. Specification complete — all open questions resolved
(see `OPEN_QUESTIONS.md`).
