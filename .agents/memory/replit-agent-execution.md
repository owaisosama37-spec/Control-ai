---
name: Replit Agent execution role
description: The intended Claude–Replit–Gemini workflow and the safety gap around invoking Replit Agent.
---

Replit Agent is part of the intended in-app workflow as the implementation and test-running role: Claude prepares the plan, Replit Agent implements in an isolated branch, and Gemini reviews the actual changes and test evidence. The owner approves merging; there is no automatic merge or deployment.

**Why:** The user clarified that Replit must be included as an agent in the design, not only as the hosting/development environment. Replit MCP documents an Agent update tool, but does not establish that the tool itself isolates branches, runs tests, or opens PRs.

**How to apply:** Do not describe an independent executor as the selected architecture. Before claiming the workflow works, verify a supported app-to-Agent invocation and build/test branch isolation, repository validation, cost limits, emergency stop, test execution, and PR creation without merge.