---
name: PNPM dependency placement
description: Package-install behavior in this workspace's PNPM monorepo
---
When adding a dependency for a specific service, target its owning workspace package rather than relying on a generic package installer to infer the correct location.

**Why:** A generic installer has previously attempted to add dependencies at the monorepo root, where the package manager rejects the operation or places them outside the service that needs them.

**How to apply:** Use the service's PNPM workspace filter for dependency changes, then verify the intended package manifest and lockfile changed. Dependency installs can restart configured workflows, so check their logs afterward.