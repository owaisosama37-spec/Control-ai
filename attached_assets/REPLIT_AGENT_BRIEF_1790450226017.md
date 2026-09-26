# StarFruit Control Room — Completion Brief for Replit Agent

> **Language:** Reply to the owner (Osama) in Arabic, Levantine dialect. Code, commits and identifiers stay in English.
> **Scope:** This brief closes every open item from your last status report. Execute phases **in order**. Do not skip the acceptance checks at the end of each phase.

---

## 0. Ground rules (read first, apply to every phase)

1. **Inspect before changing.** Start by reading the existing codebase: stack (frontend framework, backend framework, TS/JS), how Clerk is wired, the MongoDB connection module, and the existing collections (`projects`, `room_memberships`, any others). Adapt every snippet below to the existing structure and naming. The snippets are specifications, not files to paste blindly.
2. **Create a checkpoint before each phase.** One phase = one checkpoint, so any phase can be rolled back alone.
3. **Never print, log, commit or return secrets** (connection strings, API keys, signing secrets, tokens). Health/status endpoints report `configured: true/false` only.
4. **Never widen database permissions.** Keep the current limited DB user role. Do not grant `atlasAdmin`, `dbAdminAnyDatabase` or similar.
5. **No destructive data operations** (drop collection, delete many, rename DB, schema migration that rewrites documents) without asking Osama first and waiting for a yes.
6. **Every integration is optional at runtime.** If its secrets are missing, the feature shows "Not connected" in the UI and the rest of the app keeps working. The server must never crash because an optional secret is absent.
7. **Things only a human can do** (Atlas settings, Clerk production instance, DNS, creating the Slack app, GitHub App/token, email domain verification, payment for Reserved VM) — do not attempt or fake them. When you reach one, stop, tell Osama exactly what to do (he has an Arabic checklist `OSAMA_MANUAL_STEPS_AR.md`), and continue with the parts that don't depend on it.
8. Keep the existing dev experience working: the preview must still load and the DB status must stay `connected` after every phase.

---

## 1. Database connection hardening

### 1.1 Connection module
Update the existing Mongo connection module (do not create a second one):

```ts
// server/db.ts (adapt path/name to existing module)
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "test"; // current data lives in "test"; do NOT migrate

export async function connectDb() {
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    maxPoolSize: 10,
    retryWrites: true,
    // Atlas SRV connections already enforce TLS; do not disable certificate validation.
  });
}

export function dbStatus() {
  // 0=disconnected 1=connected 2=connecting 3=disconnecting
  return ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState] ?? "unknown";
}
```

Rules:
- Never set `tlsAllowInvalidCertificates` / `tlsInsecure`.
- Log connection errors by **error name/code only**, never the URI.
- Reconnect with exponential backoff (max 30 s) instead of crashing on transient errors.

### 1.2 Startup config guard
Add a startup check that runs before the server listens:

```ts
function assertConfig() {
  const isProd = process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1";
  const problems: string[] = [];
  if (!process.env.MONGODB_URI) problems.push("MONGODB_URI missing");
  if (isProd) {
    const pk = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || "";
    const sk = process.env.CLERK_SECRET_KEY || "";
    if (!pk.startsWith("pk_live_")) problems.push("Clerk publishable key is not a production key");
    if (!sk.startsWith("sk_live_")) problems.push("Clerk secret key is not a production key");
    if (!process.env.PSEUDONYM_SECRET) problems.push("PSEUDONYM_SECRET missing");
  }
  if (problems.length) {
    console.error("[config] " + problems.join("; "));
    if (isProd) process.exit(1); // refuse to run production with dev config
  }
}
```

In development, only warn. In production, refuse to start.

### 1.3 Status endpoint
`GET /api/system/status` (already exists) must return, without secrets:

```json
{
  "database": "connected",
  "dbName": "test",
  "environment": "development",
  "integrations": {
    "claude": { "configured": false },
    "gemini": { "configured": false },
    "github": { "configured": false },
    "slack": { "configured": false },
    "email": { "configured": false }
  },
  "clerkMode": "development"
}
```

`clerkMode` = `"production"` if the publishable key starts with `pk_live_`, else `"development"`.

### 1.4 Network access (human step — do not attempt)
The Atlas `0.0.0.0/0` rule stays **only during development**. The permanent fix is Phase 7 (Reserved VM + static outbound IP, then remove `0.0.0.0/0`). Until then, the mitigation is: limited DB role (already done) + a strong 32+ character random password. Tell Osama to do **Step 1** in his manual checklist (rotate the DB password — the current one was shared in plain text and is weak).

**Acceptance (Phase 1):** `/api/system/status` shows `database: connected`, contains no secret values, server survives a temporary DB outage without crashing, dev still works.

---

## 2. Integrations framework + Settings page

### 2.1 Central registry
Create `server/integrations/registry.ts`:

```ts
export type IntegrationId = "claude" | "gemini" | "github" | "slack" | "email";

export const integrations: Record<IntegrationId, { required: string[]; anyOf?: string[][] }> = {
  claude: { required: [], anyOf: [["AI_INTEGRATIONS_ANTHROPIC_API_KEY"], ["ANTHROPIC_API_KEY"]] },
  gemini: { required: [], anyOf: [["AI_INTEGRATIONS_GEMINI_API_KEY"], ["GEMINI_API_KEY"]] },
  github: { required: ["GITHUB_TOKEN", "GITHUB_WEBHOOK_SECRET", "GITHUB_REPO"] },
  slack:  { required: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET", "SLACK_APPROVALS_CHANNEL"] },
  email:  { required: ["EMAIL_FROM"], anyOf: [["RESEND_API_KEY"], ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]] },
};

export function isConfigured(id: IntegrationId): boolean {
  const def = integrations[id];
  const hasRequired = def.required.every((k) => !!process.env[k]);
  const hasAny = !def.anyOf || def.anyOf.some((group) => group.every((k) => !!process.env[k]));
  return hasRequired && hasAny;
}
```

Note: if Replit's built-in AI Integrations inject differently named env vars in this workspace, update the names above to match what is actually injected — check the environment, don't guess.

### 2.2 Settings → Integrations page (admin only)
One card per integration: name, status badge (Connected / Not connected), which secret names are missing (names only), and a "Test connection" button that calls `POST /api/integrations/:id/test` (admin only). The test does a harmless call (list 1 model, `auth.test` on Slack, `GET /repos/:repo` on GitHub, send a test email to the admin's own address) and returns `{ ok, message }`.

**Acceptance (Phase 2):** page renders with all five showing "Not connected" when no secrets exist; app works normally.

---

## 3. Claude + Gemini inside the app

### 3.1 Credentials
Prefer **Replit AI Integrations** for Anthropic and Gemini (billed through Replit, no separate key). Enable them from the Replit integrations panel if available in this workspace. If not available, fall back to user-provided secrets `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`.

### 3.2 Provider clients
```ts
// server/ai/claude.ts
import Anthropic from "@anthropic-ai/sdk";

export function claudeClient() {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey, baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined });
}
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
```

```ts
// server/ai/gemini.ts
import { GoogleGenAI } from "@google/genai";

export function geminiClient() {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  return new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
}
export const GEMINI_MODEL = process.env.GEMINI_MODEL || ""; // set to a model actually available in this workspace; verify via the test endpoint
```

Model names must be configurable via env. Verify the default Gemini model against what the integration actually offers; do not hard-code an unverified name.

### 3.3 Roles in the workflow
| Step | Agent | Input | Output (strict JSON, validated with zod) |
|---|---|---|---|
| Plan | Claude | Project brief + constraints | `{ summary, architecture, tasks: [{ id, title, description, acceptanceCriteria[], riskLevel: "low"|"medium"|"high", touches: string[] }], openQuestions[] }` |
| Security review | Gemini | Plan JSON, and later the diff/PR summary | `{ verdict: "pass"|"changes_requested"|"block", findings: [{ severity: "info"|"low"|"medium"|"high"|"critical", area, description, recommendation }] }` |

- Ask for JSON explicitly in the system prompt; parse with zod; on parse failure retry once with the validation error appended; on second failure store the raw text and mark the run `failed_parse`.
- Timeouts: 120 s per call. Max 2 retries on 429/5xx with backoff.

### 3.4 `ai_runs` collection
Every call is stored:

```ts
{
  projectId, stage: "plan" | "security_review",
  provider: "claude" | "gemini", model,
  status: "ok" | "error" | "failed_parse",
  inputTokens, outputTokens, latencyMs,
  estimatedCostUsd,   // computed from env prices, see below
  output,             // parsed JSON
  triggeredBy,        // Clerk userId
  createdAt
}
```

Prices change, so cost uses env values: `CLAUDE_PRICE_IN_PER_MTOK`, `CLAUDE_PRICE_OUT_PER_MTOK`, `GEMINI_PRICE_IN_PER_MTOK`, `GEMINI_PRICE_OUT_PER_MTOK` (default `0` → cost shown as "unknown").

### 3.5 Guards
- Per-project monthly AI budget (`project.aiBudgetUsd`, default from env `DEFAULT_AI_BUDGET_USD=20`). Refuse new runs when exceeded; show a clear message.
- Rate limit: 10 AI runs per user per hour.
- Only roles `admin` and `manager` can trigger AI runs.
- Never send secrets, env values, or other tenants' data in prompts.
- Write an audit log entry for each run (who, project, stage, status).

### 3.6 UI
On the project page: "Generate plan (Claude)" → shows tasks with risk badges; "Security review (Gemini)" → shows verdict + findings table. Both show tokens, latency, estimated cost.

**Acceptance (Phase 3):** with keys configured, a plan is generated and reviewed end-to-end, both runs appear in `ai_runs`, budget/rate limits enforced; with keys missing, buttons are disabled with "Connect Claude/Gemini in Settings".

---

## 4. Execution handoff to Replit Agent + approval policy

### 4.1 Reality check
As far as we know there is no public API to trigger Replit Agent programmatically. **Verify this.** If no such API exists, implement the *handoff* model below — do not build a fake "auto-execute" button.

### 4.2 Handoff model
For each approved task the app generates an **Execution Package** (markdown) containing: task title, context, exact acceptance criteria, files/areas allowed to change (`touches`), forbidden actions, and the Gemini findings to address. UI buttons: "Copy package" and (if GitHub connected) "Create GitHub issue". Status flow per task:

`draft → awaiting_approval → approved → in_execution → awaiting_review → merged | rejected`

Status changes are manual buttons (or automatic from GitHub webhooks in Phase 5).

### 4.3 Approval policy (`server/policy/approval.ts`)
```ts
const HIGH_RISK_AREAS = ["auth", "clerk", "database-schema", "migrations", "payments", "billing",
  "permissions", "secrets", "deployment", "delete", "infra"];

export function approvalsRequired(task: { riskLevel: string; touches: string[] }) {
  const touchesHighRisk = task.touches.some((t) => HIGH_RISK_AREAS.some((a) => t.toLowerCase().includes(a)));
  if (task.riskLevel === "high" || touchesHighRisk) return { count: 2, roles: ["admin"] };  // 2 distinct approvers, at least 1 admin
  if (task.riskLevel === "medium") return { count: 1, roles: ["admin", "manager"] };
  return { count: 1, roles: ["admin", "manager", "developer"] };
}
```
- An approver cannot approve their own request.
- A Gemini verdict of `block` prevents approval until a new review passes.
- Every approve/reject is written to the audit log with approver, timestamp, reason.

**Acceptance (Phase 4):** high-risk task cannot move to `approved` with one approval or with the requester's own approval; a blocked review prevents approval; package copy works.

---

## 5. GitHub, Slack, Email

All webhook routes must read the **raw body** (e.g. `express.raw({ type: "*/*" })` on those routes only) for signature verification, and use `crypto.timingSafeEqual`.

### 5.1 GitHub
- Secrets: `GITHUB_TOKEN` (fine-grained PAT or GitHub App token, scope: the single repo, permissions Issues RW, Pull requests R, Contents R), `GITHUB_REPO` (`owner/name`), `GITHUB_WEBHOOK_SECRET`.
- Webhook `POST /api/webhooks/github`:
```ts
import crypto from "crypto";
function verifyGithub(raw: Buffer, sigHeader?: string) {
  if (!sigHeader) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET!).update(raw).digest("hex");
  const a = Buffer.from(sigHeader), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```
- Events: `pull_request` (opened → task `awaiting_review`; closed+merged → `merged`), `issues`. Link task ↔ issue/PR by an ID tag in the title, e.g. `[SF-<taskId>]`.
- Deduplicate by `X-GitHub-Delivery` (store processed IDs 7 days).
- Respond 2xx within 10 s; do heavy work async.

### 5.2 Slack
- Secrets: `SLACK_BOT_TOKEN` (`xoxb-…`), `SLACK_SIGNING_SECRET`, `SLACK_APPROVALS_CHANNEL`.
- Verification for every Slack request:
```ts
function verifySlack(raw: Buffer, ts?: string, sig?: string) {
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay protection
  const base = `v0:${ts}:${raw.toString("utf8")}`;
  const expected = "v0=" + crypto.createHmac("sha256", process.env.SLACK_SIGNING_SECRET!).update(base).digest("hex");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```
- Routes: `POST /api/slack/commands` (`/sf-approve <taskId> [reason]`, `/sf-reject <taskId> <reason>`, `/sf-status <taskId>`), `POST /api/slack/interactions` (Approve / Reject buttons on approval messages).
- Map Slack user → app user by a **verified link** (user links their Slack ID from their profile page, confirmed via a one-time code sent by the bot). Never trust Slack display names or emails alone for approval rights.
- Approvals from Slack go through the same `approvalsRequired` policy and audit log as the web UI.
- Reply to Slack within 3 s (ack), then update the message.

### 5.3 Email
- Provider: Resend (`RESEND_API_KEY`) preferred, SMTP fallback (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`). `EMAIL_FROM` required.
- Notifications: approval requested, approved/rejected, security review blocked, budget 80% / 100%.
- Per-user opt-out setting. Queue with 3 retries; failures logged without recipient content.

**Acceptance (Phase 5):** invalid signatures → 401; replayed Slack timestamp → 401; duplicate GitHub delivery ignored; approval via Slack respects the 2-approver rule; each integration's "Test connection" passes once Osama adds secrets.

---

## 6. Team features

### 6.1 Immutable permission audit — `membership_events`
Every grant / revoke / role change on `room_memberships` writes an event **in the same code path** (use a MongoDB transaction if the cluster supports it; otherwise write the event first, then the change, and mark the event `applied: true`).

```ts
{
  roomId, targetUserId, actorUserId,
  action: "grant" | "revoke" | "role_change",
  fromRole: string | null, toRole: string | null,
  reason: string,           // required for revoke and role_change
  createdAt,
  hash, prevHash            // hash chain: sha256(prevHash + JSON of this event without hash)
}
```

Append-only enforcement:
```ts
const blocked = () => { throw new Error("membership_events is append-only"); };
for (const op of ["updateOne","updateMany","findOneAndUpdate","replaceOne","deleteOne","deleteMany","findOneAndDelete"] as const) {
  MembershipEventSchema.pre(op, blocked);
}
```
- No update/delete API routes for this collection.
- Admin page "Permission history": filter by room, user, action, date; export CSV.
- `GET /api/admin/membership-events/verify` recomputes the hash chain and reports the first broken link, if any.
- Backfill: create one `grant` event per existing membership with `reason: "backfill"` and `actorUserId: "system"` (additive only; ask Osama before running).

### 6.2 Team engagement metrics without personal data
- Collection `engagement_daily`: `{ date, pseudoId, role, projectsTouched, approvalsGiven, aiRunsTriggered, tasksMoved }`.
- `pseudoId = HMAC-SHA256(PSEUDONYM_SECRET, clerkUserId)` truncated to 16 hex chars. **No names, emails, IPs, user agents** in this collection.
- Aggregate nightly from existing events; do not add new tracking of browsing/clicks.
- Dashboard shows aggregates only (per role, per week). **Suppress any group with fewer than 5 people** ("not enough data").
- TTL index: delete `engagement_daily` documents after 180 days.
- `PSEUDONYM_SECRET`: generate a random 32-byte hex value and ask Osama to store it in Secrets (never in code).

**Acceptance (Phase 6):** attempting to update/delete a membership event throws; hash chain verifies; engagement collection contains no personal fields; small groups are suppressed.

---

## 7. Production readiness (partly human steps)

1. **Clerk production** — Osama creates the production instance and domain (manual checklist Step 5). You then: put `pk_live_…` / `sk_live_…` in **deployment** secrets only (keep dev keys in workspace secrets), set allowed origins/redirect URLs, confirm the startup guard passes.
2. **Deployment type: Reserved VM** (needed for always-on WebSockets/background jobs and for a static outbound IP). Configure run command, health check path `/api/system/status`, `NODE_ENV=production`.
3. **Static outbound IP** — after the first Reserved VM deploy, enable/obtain the static outbound IP in the deployment settings, tell Osama the exact IP, and wait for him to add it in Atlas and **delete `0.0.0.0/0`** (manual checklist Step 6). Then confirm production DB status is `connected`.
   - Note: the dev workspace does not have a static IP. After `0.0.0.0/0` is removed, development needs either a separate dev database/cluster or Osama temporarily adding the current dev IP. Explain this to him; recommend a separate free-tier dev cluster so production stays locked.
4. Security headers (helmet), CORS restricted to the production domain, request body size limit (1 MB; 5 MB for webhooks), global rate limit.
5. Error monitoring: log structured JSON; no secrets or tokens in logs.

**Acceptance (Phase 7):** deployed app loads on the production domain with Clerk live keys; startup guard passes; Atlas list contains only the static IP (and optional temporary dev IP); DB `connected` in production.

---

## 8. Final verification report

When done, send Osama (in Arabic) a short report with a table: each item from the original open list → status (Done / Waiting on Osama / Blocked) → how it was verified. Include the list of secrets still missing (names only) and which manual steps remain.

### Secrets reference (names only)
| Secret | Used by | Where |
|---|---|---|
| `MONGODB_URI`, `MONGODB_DB_NAME` | DB | workspace + deployment |
| `AI_INTEGRATIONS_*` or `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | AI | auto (Replit) or manual |
| `CLAUDE_MODEL`, `GEMINI_MODEL`, price vars, `DEFAULT_AI_BUDGET_USD` | AI config | workspace + deployment |
| `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_WEBHOOK_SECRET` | GitHub | workspace + deployment |
| `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APPROVALS_CHANNEL` | Slack | workspace + deployment |
| `RESEND_API_KEY` or `SMTP_*`, `EMAIL_FROM` | Email | workspace + deployment |
| `PSEUDONYM_SECRET` | Engagement metrics | workspace + deployment |
| Clerk dev keys | Auth (dev) | workspace only |
| Clerk live keys (`pk_live_`, `sk_live_`) | Auth (prod) | deployment only |
