---
name: Integration admin boundary
description: Why connection tests and shared service configuration cannot be authorized by room ownership
---
Integration administration belongs to an explicitly configured application-level account. Do not grant it merely because a user owns the currently selected room. When no administrator has been configured, integration controls must fail closed without interrupting ordinary room use.

**Why:** Every signed-in user has an owner role in their own private room, while integration credentials belong to the entire application. Equating room ownership with integration administration would let unrelated users exercise shared providers, including paid AI requests and test email delivery. The user approved a separate administrator policy and intends to configure the administrator account before publishing.

**How to apply:** Keep authorization enforced by the server using the authenticated identity, independent of any room-selection header or membership. Treat development and production identities separately; never auto-promote the first signup or a room owner.