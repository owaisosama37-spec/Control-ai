---
name: MongoDB Atlas connectivity
description: Network and TLS constraints for Atlas connections from Replit-managed services.
---

Replit's official documentation states that published apps do not have a static outbound IP. A current-IP `/32` allowlist entry can become stale; Atlas access therefore needs either a broader allowlist with strong authentication and TLS, or an API host with fixed egress.

**Why:** The Starfruit API's Replit-side connection probe returned a Mongoose server-selection failure with a TLS internal alert across Atlas endpoints, even after the secret was updated. The app intentionally suppresses raw connection errors, so this does not prove the exact Atlas-side cause.

**How to apply:** Keep TLS certificate verification enabled. When Atlas fails before authentication, check the active `MONGODB_URI` secret and Atlas network access before rotating credentials again. Do not broaden the allowlist without clear consent and a database user scoped to the app database.