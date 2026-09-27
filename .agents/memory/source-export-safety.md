---
name: Source export safety
description: Why legacy examples and earlier exports need archive-level credential checks.
---

When exporting this project's source, inspect the final archive for credential patterns in every included text file, including legacy examples. Exclude local environment files, prior archives, dependencies, build output, and agent metadata.

**Why:** Tracked legacy documentation and example configuration contained credential-like values that were not caught by excluding files named `.env` alone. Sanitizing the current source does not remove copies from earlier archives or repository history.

**How to apply:** Build from a reviewed file list, scan the finished archive before offering it for download, and recommend rotating previously exposed credentials through the owning provider. Never copy credential values into memory or export notes.