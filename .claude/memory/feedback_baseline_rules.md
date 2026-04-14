---
name: Baseline rules for every change
description: Three non-negotiable rules that apply to every task in this project
type: feedback
---

Every change in this project must follow three rules:

1. **Update Swagger** — add or update `@Operation`, `@Tag`, and response annotations on any new or modified endpoint. If the API contract changes, the OpenAPI annotation must change too.

2. **Commit and push to Bitbucket** — after completing a task, stage the relevant files, write a clear commit message, and push to the `origin` remote (Bitbucket). Never leave finished work uncommitted.

3. **No regressions** — read existing code before modifying it. New changes must not break existing endpoints, mobile screens, or Flyway migrations. Flyway migrations are append-only — never edit an existing `V*.sql` file.

**Why:** User stated these as non-negotiable baseline requirements for all work in this repo.

**How to apply:** At the end of every task: (a) check Swagger annotations, (b) commit + push, (c) verify nothing previously working is broken.
