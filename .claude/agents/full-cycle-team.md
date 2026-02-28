---
name: full-cycle-team
description: Launch a full review-implement-verify cycle. Phase 1 runs the expert-review-team for discovery, Phase 2 implements approved fixes in parallel, Phase 3 runs QA verification. Use when you want expert review AND fixes in one pass.
---

# Full Cycle Team

End-to-end review and implementation pipeline. Combines expert review, parallel implementation, and QA verification into a single coordinated workflow.

## Overview

This is an orchestration workflow, not a team of fixed members. It coordinates three phases, each using specialized agents:

## Phase 1 — Discovery (Read-Only)

Launch the **expert-review-team** members in parallel:
- **Nadia** — Systems Architect
- **Jiro** — Code Quality Reviewer
- **Sable** — Security Analyst
- **Quinn** — CBA Compliance Specialist
- **Lena** — Scope & Risk Analyst

All 5 analyze the codebase (or specified scope) and report findings.

**Gate:** Team lead synthesizes findings into a prioritized report and presents it to the user. Wait for user approval before proceeding to Phase 2. The user may:
- Approve all findings for implementation
- Select specific findings to implement
- Request changes to the plan
- Stop here (review-only)

## Phase 2 — Implementation (Parallel)

Spawn implementation agents to fix approved findings:
- **Max 3 fixes per agent** — prevents any single agent from taking on too much
- **Group by file ownership** — no two agents edit the same file
- **Type/schema changes get a dedicated agent** — migrations, model changes, and their downstream effects are isolated
- Each agent runs `cargo check` / `tsc --noEmit` after their changes

**Coordination rules:**
- Agents working on backend vs frontend can always run in parallel
- Agents working on different backend files can run in parallel
- If an agent needs to modify a file another agent owns, it waits or coordinates through the team lead
- Ignore compilation errors in files owned by other agents (they may be mid-edit)

## Phase 3 — QA Verification

After implementation agents complete:
1. Run full compilation: `cargo check`, `tsc --noEmit`
2. Run linting: `cargo clippy`, `npm run lint`
3. Run tests: `cargo test`
4. If backend SQL changed: `make sqlx-prepare`
5. Fix any issues found

## How to Run

Tell Claude: "Run the full-cycle-team" or "Full cycle review of [area]"

The team will:
1. Create a team with TeamCreate
2. Run Phase 1 discovery (5 expert agents in parallel)
3. Present findings and wait for approval
4. Run Phase 2 implementation (grouped parallel agents)
5. Run Phase 3 QA verification
6. Report final results

## Scoping

- "Full cycle the leave subsystem" → all phases focus on leave-related code
- "Full cycle the frontend" → skip backend-specific analysis
- "Full cycle recent changes" → focus on last N commits

## When to Use This vs Other Teams

| Situation | Use |
|-----------|-----|
| Just want expert opinions | `expert-review-team` |
| Just want to fix known issues | Direct implementation agents |
| Want review + fixes in one pass | `full-cycle-team` |
| Pre-PR review of your changes | `pr-review-team` |
| Production hardening | `qa-hardening-team` |
