# Current project manifest

| Location | Purpose |
| --- | --- |
| `artifacts/starfruit-control-room/src/App.tsx` | Branded landing, Clerk authentication, routing and private room shell |
| `artifacts/starfruit-control-room/src/pages/room.tsx` | Overview, projects, details, approvals, activity and connections |
| `artifacts/starfruit-control-room/src/components/project-form.tsx` | Validated create/edit forms |
| `artifacts/starfruit-control-room/src/index.css` | Responsive Starfruit visual theme |
| `artifacts/api-server/src/app.ts` | Express, authentication proxy, request parsing and safe errors |
| `artifacts/api-server/src/routes/room.ts` | Account-scoped project APIs and status transitions |
| `artifacts/api-server/src/lib/projects.ts` | Mongo project schema, serialization and audit signatures |
| `artifacts/api-server/src/lib/mongo.ts` | Connection management, retry cooldown and credential-safe failure handling |
| `artifacts/api-server/scripts/init-db.mjs` | Index initialization without weak default users |
| `artifacts/api-server/legacy/` | Original uploaded source and documentation, retained as reference only |
| `lib/api-spec/openapi.yaml` | Current API contract |
| `lib/api-client-react/` | Generated typed frontend client |
| `lib/api-zod/` | Generated request validation |
| `lib/db/` | Unused PostgreSQL scaffold; application data stays in MongoDB |

Original file-by-file descriptions remain in
`artifacts/api-server/legacy/PROJECT_MANIFEST.md`; they describe the uploaded
package, not the current running routes.