# Skyward Rewards MCP Server

This directory contains the runnable MCP server that ships with the template. Every tool here is a **flow**: it performs the full support workflow so the caller only needs to supply the minimal intent (usually an email address and a couple of options).

## What lives here
- `src/client/` – the HTTP adapter. The template ships with a mock adapter for convenience—replace it with a real integration before you go live (REST, GraphQL, gRPC, etc.).
- `src/tools/` – flow implementations and registry.
  - `src/tools/support.ts` contains the flow logic (e.g., look up a customer, issue goodwill, redeem a reward).
  - `src/tools/index.ts` maps the exported flows to MCP tool definitions (`customer.snapshot`, `loyalty.issueGoodwill`, `offers.assign`, etc.). Extend this file when you add new flows.
- `src/runtime/` –
  - `stdio-entry.ts`: starts the MCP server over stdio.
  - `server.ts`: registers the flow tools with the MCP SDK.
  - `llm-session.ts`: optional OpenRouter harness for LLM-in-the-loop evals.
- `src/config/load-env.ts` – lightweight `.env` loader shared by the runtime and scripts.
- `evals/` – scenarios that call the flow tools; see `evals/README.md` for details.

## Customisation checklist
1. **Adapter** – delete the mock implementation in `src/client/mock-adapter.ts` and build an adapter that targets your real services. Call `configureHttpAdapter(...)` in `src/index.ts` with your implementation.
2. **Flow tools** – edit `src/tools/support.ts` to match your workflows (e.g., loyalty, billing, fulfilment). Keep each exported function a full “flow” so the agent can call it once per task.
3. **Tool registry** – register new flows in `src/tools/index.ts` with clear names, descriptions, and JSON schemas. These definitions are what the MCP clients discover.
4. **System prompt** – update `systemPrompt()` in `src/index.ts` to describe your domain, jargon, and tool usage rules. The prompt is the primary guidance the LLM sees.
5. **Environment** – copy `.env.example` to `.env` and provide your OpenRouter/adapter settings. `LLM_MODEL`, `LLM_PROVIDER_API_KEY`, `LLM_PROVIDER_BASE_URL`, and `EVAL_LOGS_ENABLED` are used by the scripts.

## Commands
```bash
npm install
cp .env.example .env
npm run build
npm run serve   # expose the MCP server over stdio
```

Evaluation (optional):
```bash
npm run eval       # deterministic flow tests
npm run eval:llm   # OpenRouter-driven evals (requires LLM_* env vars)
```
Logs are written to `evals/logs/` only when `EVAL_LOGS_ENABLED=true`.

## Adding a new flow tool
1. Implement the workflow in `src/tools/support.ts` (or a new module) with the minimal inputs required.
2. Export it through `src/tools/index.ts` with a descriptive name and JSON schema.
3. Add/adjust scenarios in `evals/scenarios/` to assert the final outcome.
4. Update the system prompt if the new flow introduces new concepts or required context.

With these pieces in place you can iterate on your MCP server like an app: flows hide API complexity, and evals ensure outcomes stay reliable.
