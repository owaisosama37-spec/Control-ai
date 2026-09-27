---
name: Workspace restart check
description: Unexpected workspace restarts can leave the checked files out of sync with earlier successful edits.
---

After an unexpected workspace restart, inspect the current files and rerun the cheapest relevant check before relying on a pre-restart result. During one session, some recent uncommitted changes were absent afterward while other changes remained.

**Why:** A previously passing check may have measured a different working tree; blindly assuming all edits survived can deliver a type error or stale test.

**How to apply:** Verify that the relevant new lines still exist and check the current working tree before final delivery. Do not assume an edit is missing merely because a background shell ended.