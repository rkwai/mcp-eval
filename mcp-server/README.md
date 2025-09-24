# MCP Server Template

This directory contains a reference MCP server implementation. It highlights patterns you can adapt regardless of domain:

## Structure Overview
- `src/index.ts` – Exposes the MCP entrypoint (`runTool`, `systemPrompt`).
- `src/tools/` – High-level tool implementations; keep them intent-driven and decoupled from transport details.
- `src/client/` – HTTP adapter definitions. Swap in a live adapter or keep the mock for evals.
- `src/data/` – Mock data used by the default adapter. Replace with real integrations as needed.
- `evals/` – Scenario definitions (`scenarios/`) and logs (`logs/`) that validate tool behaviour.
- `scripts/` – Utility scripts, including `run-evals.ts` for executing scenarios.

## Tooling Patterns
- Tools should express agent intent (e.g., `support.lookupCustomer`) rather than mirror REST routes.
- Validation lives at the tool boundary: check required fields, coercions, and guardrails before calling adapters.
- Responses should include structured data that downstream orchestrators can rely on (IDs, balances, metadata).

## Adapters & Mocks
- `src/client/api.ts` defines a simple HTTP adapter interface (`HttpAdapter`).
- `src/client/mock-adapter.ts` + `src/data/mock-store.ts` show how to provide deterministic responses without real APIs.
- Replace the mock adapter with a live implementation when integrating with REST or GraphQL endpoints. Authentication, retry logic, and circuit breakers can be added here without touching tools or evals.

## Evals
Evals live under `evals/scenarios/` and are intended to run in mock mode by default. They assert:
- Which tool is called, with what arguments.
- The structure of the returned payload.
- Multi-step workflows (e.g., lookup → goodwill credit → summary).

Run them with:
```bash
# Mock mode (default)
npm run eval:run

# Live mode (if you wire a real adapter)
EVAL_MODE=live npm run eval:run
```

## Extending the Template
1. **Add integrations** – Implement a custom `HttpAdapter` (or GraphQL client) and call `configureHttpAdapter` during startup.
2. **Add tools** – Create intent-centric modules in `src/tools/` and register them in `src/tools/index.ts`.
3. **Add scenarios** – Describe conversational workflows in `evals/scenarios/` so regressions are caught early.
4. **Automate** – Wire `npm run build` and `npm run eval:run` into CI to keep tool semantics stable.

This support-themed implementation is just an example. Replace the mock data, adapters, and toolset with your own APIs while keeping the structure, guardrails, and eval discipline.
