# Observability Plan

## Product Signals
- Key user events: `eval_run_started`, `eval_run_completed`, `tool_call_mismatch_detected`, `scenario_passed`; captured via JSONL logs and summarised in CLI reports.
- Dashboards: Nightly Markdown summary from `npm run eval:report`; CRM funnel dashboard for self-serve → paid conversions; Stripe revenue snapshot for DWY/DFY tiers.
- Alert thresholds: CI pipeline fails if pass rate drops below 95% or mean tool-call latency increases by >20% vs. prior week; manual alert when more than two DFY projects exceed expected hours.

## Technical Signals
- Service metrics: API latency/availability from `api-service` (p90 < 400ms), MCP tool execution duration, queue depth for long-running tools.
- Logs/traces: Structured logs in `mcp-server/evals/logs/`; request correlation via `X-Request-ID`; optional OpenTelemetry traces when integrating with observability backend.
- Alert routing: PagerDuty rotation for evaluation engineers; Slack `#mcp-eval-support` channel for non-blocking notifications; weekly review of trend anomalies.

## Actions & Owners
| Area | Owner | Update Needed | Status |
|------|-------|---------------|--------|
| Eval logging schema | Eval Analytics Lead | Add schema validation step in CI | Planned |
| API latency monitoring | Backend Lead | Instrument `api-service` with basic metrics middleware | In Progress |
| Revenue signal tracking | Growth Ops | Sync Stripe + HubSpot data monthly | Active |
| DFY project margin review | Finance | Add post-engagement review template | Planned |

_Last updated: 2025-09-19_
