# Starfruit Control Room

A working first release for private project tracking, approval decisions, budgets,
and signed activity, based on the supplied Starfruit archive.

## Implemented
- Clerk sign-up, sign-in and sign-out. No default passwords or seeded users.
- Private rooms with explicit owner/editor/reviewer/viewer membership and room-scoped access checks.
- Projects in MongoDB, using the source's project fields and stages; legacy unowned records remain quarantined.
- Create, view, edit and soft-delete projects; search and filter.
- Manual project plan approval, review submission, rejection, merge-status and pause/resume.
- Manual task records linked to projects, hand-entered plans, owner decisions, task pause/resume, and signed history.
- Owner-only emergency stop for new room mutations, with persistent state and signed events.
- Server-enforced transitions and optimistic status concurrency checks.
- Dashboard totals computed from stored projects.
- Signed project, task, team-membership and room-control activity.
- Connection status with explicit unconfigured integration states.

## Not enabled
Autonomous AI execution, model-generated plans or reviews, isolated-code workers,
branch/PR creation, real GitHub merge, Slack notifications or commands, email,
night runs, token/cost enforcement, and legacy-data import.
GitHub webhook signatures can be checked, but PR events are acknowledged without
changing projects. Task approval and project status changes are records only:
they do not run code, merge a PR, or deploy an application.

The imported source is preserved under `artifacts/api-server/legacy`. Its original
routes are **not mounted**: they contain insecure defaults and incomplete behavior.
Do not run the legacy seed script or server as the production application.

See `SETUP_GUIDE.md` and `PROJECT_MANIFEST.md`.