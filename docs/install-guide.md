# ServiceNow Auto-Assigner — Installation Guide

ServiceNow Auto-Assigner is delivered through **source control**: you point your
ServiceNow instance at a Git repository and import the scoped application from
it. This guide takes you from a clean instance to a running app.

There are four steps:

1. [Connect your ServiceNow instance to GitHub](#1-connect-your-servicenow-instance-to-github)
2. [Make your own copy of the repository](#2-make-your-own-copy-of-the-repository)
3. [Import the app into ServiceNow](#3-import-the-app-into-servicenow)
4. [Post-install setup](#4-post-install-setup)

---

## 1. Connect your ServiceNow instance to GitHub

Auto-Assigner installs over source control, so your instance needs a **secure
connection / credential that can read a GitHub repository**.

**How you set this up is up to your organisation.** Different organisations have
different security policies and approved methods — a personal access token, a
GitHub App, a deploy key, OAuth, or a dedicated machine user — so this guide does
**not** prescribe one. Work with your ServiceNow administrator and your GitHub
administrator to create a credential your instance can use to read your
repository over HTTPS.

ServiceNow's own *"Link to source control"* / source-control credentials
documentation covers the supported options.

> Once that secure connection exists and your instance can authenticate to
> GitHub, continue below.

---

## 2. Make your own copy of the repository

You should import from a repository **you control**, not directly from the
public source — so you can manage access, apply your own credentials, and pin
the version you've tested. Create your own GitHub repo from this one using
whichever option suits you:

**Option A — Fork (simplest)**

On GitHub, open
`https://github.com/Perpaterb/serviceNow-auto-assigner-plugin` and click
**Fork**.

**Option B — Mirror into a brand-new (e.g. private) repo**

1. Create a new **empty** repository in your GitHub organisation (no README).
2. Mirror-clone the source and push it into yours:

   ```bash
   git clone --bare https://github.com/Perpaterb/serviceNow-auto-assigner-plugin.git
   cd serviceNow-auto-assigner-plugin.git
   git push --mirror https://github.com/<your-org>/<your-repo>.git
   ```

**Option C — GitHub Importer**

Go to `https://github.com/new/import` and import from the source URL above.

Whichever you choose, note **your repository's HTTPS URL** and its **default
branch** (`main`) — you'll need both in the next step.

---

## 3. Import the app into ServiceNow

1. In your ServiceNow instance, open **Studio** (filter navigator → *Studio*).
2. Click **Import From Source Control**.
3. Enter:
   - **URL** — your repository's HTTPS URL from step 2.
   - **Credential** — the secure connection from step 1.
   - **Branch** — `main`.
4. Click **Import**. ServiceNow pulls the scoped application (**Auto Assigner**,
   scope `x_1578378_aa`) and creates everything it needs: tables, ACLs, the
   `x_1578378_aa.queue_manager` role, the Service Portal page and widget, and the
   assignment-engine scheduled job.
5. When it finishes, open the application.

> Already linked this app on the instance before? Use **Apply Remote Changes**
> instead, to pull the latest commits.

---

## 4. Post-install setup

A few one-time checks before your team uses it:

**Confirm the engine is running.** The scheduled job **"Auto-Assigner Engine"**
ships active and runs every few minutes. It only assigns tickets when an
assigner has been **Started** and the current time is inside that assigner's
active window — so nothing happens until a manager turns one on.

**Grant access.** For someone to configure and run assigners they need **both**:

- the **`x_1578378_aa.queue_manager`** role, and
- membership of the **assignment group** they'll manage.

Everyone else who is a member of the group gets a read-only view. (Role changes
take effect on the user's next login.)

**Open the page.** Browse to **`/sp?id=auto-assigner`** on your instance. A queue
manager can now create an assigner, choose its assignment group, set up shifts
and working hours, and press **Start**.

From here, see the **[User Guide](user-guide.md)** for everyday use.

---

## Updating to a newer version

1. Bring the new commits into **your** repository (sync your fork, or pull and
   push the updates).
2. In ServiceNow **Studio → Apply Remote Changes** to import them into the
   instance.
