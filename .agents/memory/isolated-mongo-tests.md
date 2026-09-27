---
name: Isolated Mongo test fidelity
description: How to interpret failures from the project's in-memory database adapters for route tests.
---

In isolated route tests, emulate the observable database semantics needed by the route, especially detached lean-query results and transaction rollback. A chainable fake query alone is not enough.

**Why:** A stored object returned by reference can be mutated by a later fake update, making a valid before/after audit event appear to have the same old and new role. Missing transaction behavior turns legitimate route calls into unrelated server errors. These failures describe the fake adapter, not necessarily the route.

**How to apply:** When a route starts using a new query method or transaction, extend the isolated adapter to model it and add a rollback assertion for write-plus-audit operations. Keep separate real-database verification explicitly pending rather than treating the fake as proof of persistence.