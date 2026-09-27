---
name: Replit Agent execution role
description: The intended Claude–Replit–Gemini workflow and the safety gap around invoking Replit Agent.
---

The intended in-app workflow has three distinct roles: Claude receives strategic requests, decomposes them into detailed engineering plans, designs databases, and produces implementation guidance; Replit Agent turns those plans into code, handles files and interfaces, runs tests in an isolated execution environment and Git branch, and produces PR links; Gemini reviews actual code changes, security vulnerabilities, token usage, and economic efficiency. The application itself must meter and enforce token/cost limits, not rely on Gemini's judgment. The owner approves merging; there is no automatic merge or deployment.

**Why:** The user clarified that Replit must be included as an agent in the design, not only as the hosting/development environment. Replit MCP documents an Agent update tool, but does not establish that the tool itself isolates branches, runs tests, or opens PRs.

**How to apply:** Do not describe an independent executor as the selected architecture. Isolated "containers" are a design requirement, not a verified current capability. Before claiming the workflow works, verify a supported app-to-Agent invocation and build/test isolation, repository validation, measured token/cost limits, emergency stop, test execution, and PR creation without merge.