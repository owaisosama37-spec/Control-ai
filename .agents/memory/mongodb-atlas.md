---
name: MongoDB Atlas connectivity
description: Network and TLS constraints for Atlas connections from Replit-managed services.
---

Replit's official documentation states that published apps do not have a static outbound IP. In this project, the observed outbound `/32` did not allow the MongoDB connection, while a temporary `0.0.0.0/0` rule did after the app user was scoped to the `test` database.

**Why:** The Starfruit API's Replit-side connection probe returned a TLS internal alert across Atlas endpoints with the `/32` rule, then connected and passed `ping` after the broader rule was active. Replit's HTTP-observed address was not sufficient evidence of MongoDB TCP egress.

**How to apply:** Keep TLS certificate verification enabled. When Atlas fails before authentication, check the active `MONGODB_URI` secret and Atlas network access before rotating credentials again. Do not use a broad allowlist without clear consent and a database user scoped to the app database; treat it as a security tradeoff if Replit egress cannot be fixed.