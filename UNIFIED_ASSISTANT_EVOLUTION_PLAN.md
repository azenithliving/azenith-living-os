# Unified Assistant Evolution Plan

## North Star

The unified assistant must become an operational intelligence layer for the project, not a chat surface. It may only claim a capability when that capability has:

- Intent coverage
- A real executor
- Risk and approval policy
- Verification strategy
- Execution evidence
- Audit logging
- A real recovery path or a clear blocked state

## Non-Negotiable Contract

The assistant must never say a task is complete unless the result is backed by evidence. Valid outcomes are:

- `verified_success`
- `success_unverified`
- `partial_success`
- `needs_approval`
- `blocked_missing_dependency`
- `failed_recovered`
- `failed`

## Capability Layers

1. Understanding: classify natural Arabic/English owner requests.
2. Planning: convert requests into steps, risks, tools, and evidence needs.
3. Execution: run real tools only.
4. Verification: check the effect after execution.
5. Evidence: return ids, counts, URLs, checksums, before/after values, or request ids.
6. Audit: record every action and result.
7. Recovery: try real fallback paths before failing.
8. Learning: add patterns and tests from successful executions.

## First Implementation Package

- Add a capability contract and audit module.
- Derive assistant capabilities from the real tool registry.
- Require verification strategies for every tool.
- Require approval for dangerous tools.
- Add a torture-suite foundation test that checks capability honesty.

## Next Packages

- Add evidence objects to each tool result.
- Add a self-test endpoint for safe assistant capabilities.
- Add UI panels for capability status and evidence.
- Add chaos tests for missing Blob, WhatsApp, Supabase, and AI providers.
- Add before/after verification to SEO, content, backup, and project evolution tools.
