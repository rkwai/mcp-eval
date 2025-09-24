# MCP Server Template

This repository is a starting point for building, testing, and shipping Model Context Protocol (MCP) servers that sit in front of existing APIs. It focuses on:

- Designing intent-driven tools so downstream LLMs never deal with raw endpoint plumbing.
- Providing a pluggable adapter layer (REST today, extensible to GraphQL/auth later) with a built-in mock implementation.
- Authoring scenario-based evals that confirm the MCP server calls the correct tools with the right payloads.

## Structure Overview
- `mcp-server/src/index.ts` – Exposes the MCP entrypoint (`runTool`, `systemPrompt`).
- `mcp-server/src/tools/` – High-level tool implementations; keep them intent-driven and decoupled from transport details.
- `mcp-server/src/client/` – HTTP adapter interface plus a mock adapter (contains the sample dataset). Swap in live integrations when needed.
- `mcp-server/evals/` – Scenario definitions (`scenarios/`) and logs (`logs/`) that validate behaviour.
- `mcp-server/scripts/` – Utility scripts, including `run-evals.ts` for executing the scenarios.

The `mcp-server/evals` directory also includes a domain example (loyalty support) to demonstrate how to structure realistic workflows—see `mcp-server/evals/README.md` for details.

## Quick start
```bash
cd mcp-server
npm install
npm run build
npm run eval:run       # mock mode by default (no external APIs required)
# EVAL_MODE=live npm run eval:run   # switch to live mode if you wire a real adapter
```

## Extending the Template
1. **Adapters** – Implement a custom `HttpAdapter` (REST or GraphQL) and call `configureHttpAdapter` during startup to hit real services. Add auth, retries, or circuit breakers here without touching tools.
2. **Tools** – Add new intent-centric modules in `src/tools/` and register them in `src/tools/index.ts`. Validate inputs, enforce guardrails, and shape responses for downstream agents.
3. **Scenarios** – Describe conversational workflows in `evals/scenarios/` so regressions are caught early. Use the mock dataset or inject your own fixtures.
4. **Automation** – Wire `npm run build` and `npm run eval:run` into CI to keep tool semantics stable as APIs evolve.

Clone the template, adapt the adapters, author your domain-specific evals, and keep the mocks representative of production data so your MCP server stays reliable.
