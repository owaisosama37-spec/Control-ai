---
name: Slack connector boundary
description: Why connected Slack account access is distinct from slash commands and approvals
---
The connected Slack account supports outbound Web API requests using the installer's user permissions. Do not treat that connection, or a successful auth.test, as proof that slash commands, event delivery, a bot, or approval notifications are configured.

**Why:** The standard connector does not provide a Slack Events API or command app. Incoming commands need a separately configured Slack app and a published request URL, and approvals cannot act on private rooms until the Slack sender is explicitly mapped to an authorized app identity.

**How to apply:** Separate account-access testing from inbound-command readiness in status and UI. Never use a repository/channel event or an unverified Slack user ID to approve or mutate a private project. Verify real provider delivery only after publishing and configuring the provider endpoint.