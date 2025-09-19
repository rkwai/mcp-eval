# C4 System Map

## C1 — System Context
- Primary system purpose: Provide an evaluation-driven MCP server that surfaces existing REST capabilities with verifiable tool-call behaviour.
- Key users and external systems: Platform engineers, evaluation leads, MCP clients (CLI or orchestrators), optionally observability backends.
- High-level money/information flow with the surrounding ecosystem: Prospects encounter the template, run evals via MCP, and progress through paid tiers; eval insights drive coaching and delivery engagements.
- Risks or assumptions at the system boundary: Reliance on JSONL logs for truth; assumes REST APIs remain stable; DFY clients may require stricter data isolation.

## C2 — Container Diagram
| Container | Purpose | Technology | Inbound/Outbound Interfaces |
|-----------|---------|------------|-----------------------------|
| API Service | Hosts reusable REST endpoints backing MCP tools | Express + TypeScript | Receives MCP tool calls; exposes HTTP endpoints to MCP server |
| MCP Server | Translates prompts/tool calls into REST interactions and eval artefacts | TypeScript MCP runtime | Accepts MCP client requests; invokes API service; emits logs |
| Eval Harness | Executes scenarios and collates results | Node CLI / scripts | Calls MCP server; writes to log store |
| Log Storage & Reporting | Retains eval logs and produces summaries | Filesystem + CLI report | Consumes JSONL logs; outputs Markdown summaries |

Notes:
- Deployment/hosting considerations: API service and MCP server can run co-located or separately; eval harness runs in CI workflows; logs stored in repo or object storage.
- Cross-container data contracts: JSON schemas for tool payloads; eval log schema `{timestamp, run_id, scenario, tool_calls[], status}`.

## C3 — Component View (per Container)
```
Container: API Service
  Components:
    - MetricsController: wraps metrics aggregation endpoints from existing REST stack.
    - ReportsController: composes eval summaries for stakeholder delivery.
    - ArtefactController: handles regression diff uploads and retrieval.
  Integration notes:
    - Internal APIs / events: Optionally publishes `eval.summary.generated` events for automations.
    - Observability coverage: Add request timing middleware; log correlation IDs.

Container: MCP Server
  Components:
    - ToolRegistry: Maps MCP tool names to API calls and validators.
    - PromptManager: Maintains system prompts and guidance for tool selection.
    - EvalLogger: Writes structured JSONL logs for each scenario.
  Integration notes:
    - Internal APIs / events: Uses API Service via HTTP; optional event bus for long-lived tasks.
    - Observability coverage: Emit tool-call metrics via `npm run eval:report`; capture errors in logs.

Container: Eval Harness
  Components:
    - ScenarioLoader: Reads scenario definitions from `evals/scenarios/`.
    - Runner: Executes sequential/parallel tool calls via MCP client SDK.
    - Reporter: Generates Markdown summaries and regression diffs.
  Integration notes:
    - Internal APIs / events: Invokes MCP server; writes logs to `evals/logs/`.
    - Observability coverage: CLI exits non-zero on regressions; integrate with CI badges.
```

## Change Log
- 2025-09-19: Added initial C1/C2/C3 views for API + MCP architecture and logged integration considerations.

_Last updated: 2025-09-19_
