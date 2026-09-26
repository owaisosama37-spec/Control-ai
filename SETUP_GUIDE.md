# Setup guide — current Replit application

## 1. Install
This is a pnpm workspace. Run `pnpm install`, not `npm install`.

## 2. Database
Provide `MONGODB_URI` through Replit Secrets. Use an Atlas database user with access
to the intended database and configure its network access for the deployment.
Never paste the URI into chat, source files or logs. Existing source records are
not automatically assigned to a newly registered account.

Run `pnpm run db:init` to initialize indexes. This does not create accounts or
sample records and does not reset existing data.

## 3. Authentication
Clerk is provisioned for this app; its required keys are managed in the environment.
Use the app's Create account / Sign in pages. Development and production accounts
are separate. Original JWT credentials are not imported.

There are no admin123-style default accounts. Each signed-in account accesses its
own private room. Shared team access and legacy-account migration remain future work.

## 4. Run
Use the configured Replit workflows:
- `artifacts/api-server: API Server`
- `artifacts/starfruit-control-room: web`

The workflows supply the service ports and preview routing. Open the app preview,
not a guessed localhost port or a historical repl.co address.

Checks: `pnpm run typecheck`. Regenerate contracts after API changes with
`pnpm --filter @workspace/api-spec run codegen`.

## 5. External integrations
GitHub, Slack and SMTP are not activated yet. Authorize the intended accounts
through secure integration setup before enabling them. The app deliberately
reports these connections as not connected. No integration tokens are needed
for the initial project-management release.

## API
Public: `GET /api/healthz`, `GET /api/system/status`.
Authenticated using Clerk cookies:
- `GET /api/projects`, `POST /api/projects`
- `GET /api/projects/:id`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id`
- `PUT /api/projects/:id/status`
- `GET /api/dashboard`, `GET /api/audit`

Exact schemas are in `lib/api-spec/openapi.yaml`. Status requests include both the
desired status and expected_status; conflicting updates return 409.

## Operational limits
- MongoDB failure returns 503 rather than silently saving in memory.
- Audit signatures use SESSION_SECRET when set, otherwise the managed Clerk
  server key. Keep this signing key stable; key rotation requires an audit-key
  migration to preserve verification of historical signatures.
- The activity feed returns the latest 200 records. Project removal is a soft
  deletion retaining history, not a privacy erasure endpoint.
- This first release is not a certified compliance system or autonomous agent.