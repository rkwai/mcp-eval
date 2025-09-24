# MCP Server Template

This repository is a starting point for building, testing, and shipping Model Context Protocol (MCP) servers that sit in front of existing APIs. It focuses on:

- Designing intent-driven tools so downstream LLMs never deal with raw endpoint plumbing.
- Providing a pluggable adapter layer (REST today, extensible to GraphQL/auth later) with a built-in mock implementation.
- Authoring scenario-based evals that confirm the MCP server calls the correct tools with the right payloads.

## Structure Overview
- `mcp-server/src/index.ts` – Exposes the MCP entrypoint (`runTool`, `systemPrompt`).
- `mcp-server/src/tools/` – High-level tool implementations; keep them intent-driven and decoupled from transport details.
- `mcp-server/src/client/` – HTTP adapter interface plus a mock adapter (contains the sample dataset). Swap in live integrations when needed.
- `mcp-server/src/runtime/` – Hosts the MCP stdio server (`server.ts`, `stdio-entry.ts`) and the LLM evaluation harness (`llm-session.ts`).
- `mcp-server/evals/` – Scenario definitions (`scenarios/`) and logs (`logs/`) that validate behaviour.
- `mcp-server/scripts/` – Utility scripts, including `run-evals.ts` for executing the scenarios.
- `mcp-server/.env.example` – Environment template for wiring live APIs or LLM credentials.

The `mcp-server/evals` directory also includes a domain example (loyalty support) to demonstrate how to structure realistic workflows—see `mcp-server/evals/README.md` for details.

## Quick start
```bash
cd mcp-server
npm install
cp .env.example .env             # populate LLM_PROVIDER, LLM_MODEL, LLM_PROVIDER_API_KEY, LLM_PROVIDER_BASE_URL
npm run build
npm run serve                     # exposes the MCP server over stdio (mock adapter by default)
npm run eval                     # deterministic tool-mode evals (no LLM required)
npm run eval:llm                 # LLM-in-the-loop evals (provider from LLM_PROVIDER or --provider)
```

`npm run eval:llm` expects `LLM_PROVIDER` (defaults to `openai`), `LLM_MODEL`, `LLM_PROVIDER_API_KEY`, and `LLM_PROVIDER_BASE_URL` in your environment.

## Extending the Template
1. **Adapters** – Implement a custom `HttpAdapter` (REST or GraphQL) and call `configureHttpAdapter` during startup to hit real services. Add auth, retries, or circuit breakers here without touching tools.
2. **Tools** – Add new intent-centric modules in `src/tools/` and register them in `src/tools/index.ts`. Validate inputs, enforce guardrails, and shape responses for downstream agents.
3. **Scenarios** – Describe conversational workflows in `evals/scenarios/` so regressions are caught early. Each scenario now supports both deterministic tool assertions and an optional `conversation` script that the LLM harness replays.
4. **Automation** – Wire `npm run build`, `npm run eval`, and `npm run eval:llm` into CI to keep tool semantics stable as APIs evolve.

Clone the template, adapt the adapters, author your domain-specific evals, and keep the mocks representative of production data so your MCP server stays reliable.
