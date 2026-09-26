# Starfruit Control Room

Private project tracking and manual delivery approvals, adapted from the user's
uploaded Node/MongoDB application.

## Run and verify
- Use managed API and Starfruit web workflows.
- `pnpm run typecheck`
- `pnpm run db:init` creates Mongo indexes only, never default users.
- `pnpm --filter @workspace/api-spec run codegen` after contract changes.

## Important decisions
- Preserve MongoDB. The PostgreSQL scaffold is unused; do not migrate data there.
- Clerk provides login; old JWT routes and insecure default-account seeding are
  preserved as source reference only under api-server/legacy, not executed.
- All room data is scoped by verified account identity. Never claim unowned legacy
  documents for the first account that registers.
- This release tracks manual decisions. Do not label agents or integrations online
  without a real authorized connection and working execution path.
- Keep source status names and project field names for future legacy imports.

See root SETUP_GUIDE.md for current operation and PROJECT_MANIFEST.md for file map.