# Analytics Platform Reference

## Description
Analytics for the MCP Evaluation Template are intentionally light-weight. We rely solely on structured logs emitted from eval runs to understand tool-call accuracy, latency, and failure modes. No external BI or product analytics systems are required.

## Implementation-Relevant Details
- Log format & storage: Each eval run writes a JSONL log to `mcp-server/evals/logs/` with schema `{ timestamp, run_id, scenario, tool_calls[], status }`.
- Naming conventions and taxonomy: Log files follow `eval-<scenario>-<UTC timestamp>.jsonl`; scenarios map to the `journey_*` identifiers stored in `mcp-server/evals/scenarios/`.
- How to onboard new metrics: Extend the log writer in `mcp-server/src/evals/log_writer.ts` (or equivalent) to append additional fields; document the change in the eval runbook.
- Alerting configuration: Optional CLI check `npm run eval:report` highlights regressions (pass rate drop >5%) and exits non-zero for CI pipelines.

## Key Dashboards & Metrics
| View | Purpose | Location | Notes |
|------|---------|----------|-------|
| Eval run summary report | Aggregates pass/fail counts and mean tool-call latency | `npm run eval:report` (outputs Markdown) | Designed for quick CLI review post-run |
| Regression diff viewer | Compares latest logs against golden transcripts | `mcp-server/evals/logs/regressions/` | Generated only when mismatches occur |

## Update Cadence & Owners
- Refresh frequency: Logs generated on every eval run; summary report executed at least nightly in CI.
- Primary owner/contact: Priya Shah (Eval Analytics Lead) – priya.shah@example.com
- Escalation path for issues: Open a ticket in `#mcp-eval-support` Slack channel; on-call rotates weekly among evaluation engineers.

## Validation Checklist
- Last audit date: 2024-04-08
- Reviewer: Mateo Ruiz (Data Quality Lead)
- Known gaps or follow-up actions: Automate archival of logs older than 90 days; add schema validation to prevent fields drifting across teams.
