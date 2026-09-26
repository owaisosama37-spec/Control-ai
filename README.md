# Starfruit Control Room

A working first release for private project tracking, approval decisions, budgets,
and signed activity, based on the supplied Starfruit archive.

## Implemented
- Clerk sign-up, sign-in and sign-out. No default passwords or seeded users.
- Account-isolated projects in MongoDB, using the source's project fields and stages.
- Create, view, edit and soft-delete projects; search and filter.
- Manual plan approval, review submission, rejection, merge-status and pause/resume.
- Server-enforced transitions and optimistic status concurrency checks.
- Dashboard totals computed from stored projects.
- Signed activity records written atomically with changes in the project document.
- Connection status with explicit unconfigured integration states.

## Not enabled
GitHub operations, Slack notifications, SMTP email, AI execution, autonomous
orchestration, real-time WebSockets, shared team roles and account migration.
Changing a status never executes code, merges a PR, or deploys an application.
The current workspace is private to each account, not a shared team workspace.

The imported source is preserved under `artifacts/api-server/legacy`. Its original
routes are **not mounted**: they contain insecure defaults and incomplete behavior.
Do not run the legacy seed script or server as the production application.

See `SETUP_GUIDE.md` and `PROJECT_MANIFEST.md`.