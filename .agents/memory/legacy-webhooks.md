---
name: Legacy webhook boundary
description: Why legacy webhook tests and handlers must remain separate from the active room API
---
Treat the legacy webhook server as a local compatibility surface, not as the active application's integration endpoint. A successful locally signed request proves signature parsing and dispatch only; it does not prove that GitHub or Slack has delivered a real event to the current API.

**Why:** The legacy service has a separate, globally scoped project and user model, while the current application enforces account/room-scoped access. Silently mounting legacy write handlers on the current API could bypass that boundary and alter unrelated project data.

**How to apply:** Keep local smoke checks non-mutating; test write behavior against isolated models or a test database. Before enabling real provider delivery, design current-API routes with its authorization and ownership model, then verify provider configuration and actual inbound delivery separately. After changing the legacy route, actually start the server: a syntax-only check does not detect a missing named export imported by another module.