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
own private room and can explicitly grant whole-room access to registered Clerk
users. Unowned legacy records stay inaccessible; legacy migration is not automatic.

## 4. Run
Use the configured Replit workflows:
- `artifacts/api-server: API Server`
- `artifacts/starfruit-control-room: web`

The workflows supply the service ports and preview routing. Open the app preview,
not a guessed localhost port or a historical repl.co address.

Checks: `pnpm run typecheck`. Regenerate contracts after API changes with
`pnpm --filter @workspace/api-spec run codegen`.

## 5. External integrations
GitHub repository access uses a connected account rather than the old
`GITHUB_TOKEN`. The current API accepts signed GitHub pings at
`POST /api/webhooks/github` and rejects invalid signatures or repositories.
Other signed events are acknowledged but **not** applied to room projects:
account-scoped project/PR linking is not configured. Local signed requests
do not prove provider delivery. Publish the app and use its production URL
for the GitHub repository webhook, then verify an actual delivery in GitHub.
Do not use a development URL or the legacy server's local tests as proof.

Slack account access can be tested through the connected Replit integration.
That user-scoped connection supports outbound Slack Web API calls only. It does
not create slash commands or receive events. Incoming commands need a separate
Slack app, a published request URL and a trustworthy mapping from Slack users
to authorized room members; the current application does not execute them.
Resend's connected account may be restricted to sending, so its domains cannot
necessarily be listed or verified from the app. To enable test email through
the connector set `RESEND_CONNECTOR_ENABLED=true`, configure a verified
`EMAIL_FROM`, and explicitly choose `INTEGRATIONS_ADMIN_USER_ID`. Testing then
sends to that administrator's verified primary Clerk email. Until these
settings exist, email is not activated.

## API
Public: `GET /api/healthz`, `GET /api/system/status`,
signed `POST /api/webhooks/github`.
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
- The room owner can activate `/api/emergency-stop` and clear it with
  `/api/emergency-resume`. The state is stored per room in MongoDB and blocks
  new project/member mutations while stopped; signed activation/clear events
  appear in `/api/audit`. Reads continue. Requests already in flight may finish.
- Only the room owner can approve the final transition from `awaiting_review`
  to `merged`; a reviewer may resume a previously approved paused project.
  This is an audit decision,
  **not** a GitHub merge, a deployment, or proof of a reviewed PR. A reviewer
  cannot record that final decision.
- There is no autonomous task runner or sleep mode. Never assume stopping a
  room can halt external services or code running outside this application.
- This first release is not a certified compliance system or autonomous agent.