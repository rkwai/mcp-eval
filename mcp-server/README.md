# Skyward Rewards MCP Server

This directory contains the runnable MCP server that ships with the template. Every tool here is a **flow**: it performs the full support workflow so the caller only needs to supply the minimal intent (usually an email address and a couple of options).

## What lives here
- `src/client/` – adapter plumbing shared across transports.
  - `transport.ts` exposes the `Transport` interface plus the fetch transport for live APIs.
  - `mock-transport.ts` provides the in-memory dataset used by default.
  - `support-adapter.ts` turns a transport into domain-specific helper methods consumed by the tools.
- `src/tools/` – flow implementations and registry.
  - `src/tools/support.ts` contains the flow logic (e.g., look up a customer, issue goodwill, redeem a reward).
  - `src/tools/index.ts` maps the exported flows to MCP tool definitions (`customer.snapshot`, `loyalty.issueGoodwill`, `offers.assign`, etc.). Extend this file when you add new flows.
- `src/runtime/` –
  - `http-entry.ts`: streamable HTTP bootstrap used by `npm run serve`.
  - `stdio-entry.ts`: legacy stdio bootstrap for clients without HTTP support.
  - `server.ts`: registers the flow tools with the MCP SDK.
  - `llm-session.ts`: optional OpenRouter harness for LLM-in-the-loop evals.
- `src/config/load-env.ts` – lightweight `.env` loader shared by the runtime and scripts.
- `evals/` – scenarios that call the flow tools; see `evals/README.md` for details.

## Customisation checklist
1. **Transport + adapter** – replace the mock transport (`createMockTransport`) with your own implementation of `Transport` (REST, GraphQL, gRPC, etc.) and wire it in via `useTransport(...)` (see `src/index.ts`). If you need additional helper methods, extend `buildSupportAdapter`.
2. **Flow tools** – edit `src/tools/support.ts` to match your workflows (e.g., loyalty, billing, fulfilment). Keep each exported function a full “flow” so the agent can call it once per task.
3. **Tool registry** – register new flows in `src/tools/index.ts` with clear names, descriptions, and JSON schemas. These definitions are what the MCP clients discover.
4. **System prompt** – update `systemPrompt()` in `src/index.ts` to describe your domain, jargon, and tool usage rules. The prompt is the primary guidance the LLM sees.
5. **Environment** – copy `.env.example` to `.env` and provide your OpenRouter/adapter settings. `LLM_MODEL`, `LLM_PROVIDER_API_KEY`, `LLM_PROVIDER_BASE_URL`, and `EVAL_LOGS_ENABLED` are used by the scripts.

## Live adapter quickstart
1. Uncomment and fill `API_BASE_URL` in `.env`. Optional helpers:
   - `API_DEFAULT_HEADERS` (JSON) or `API_BEARER_TOKEN` for auth.
   - `API_TIMEOUT_MS` to override the default 15s request timeout.
2. Run `npm run eval:e2e` to exercise the flows end-to-end with the live adapter (LLM-driven tool calls).
3. Keep deterministic (`npm run eval`) and LLM (`npm run eval:llm`) runs in CI for rapid regression checks.

## Commands
```bash
npm install
cp .env.example .env
npm run build
npm run serve        # launch streamable HTTP server (default http://0.0.0.0:3030/mcp)
# npm run serve:stdio # legacy stdio transport if your client does not support HTTP
```

Evaluation (optional):
```bash
npm run eval       # deterministic flow tests
npm run eval:llm   # OpenRouter-driven evals (requires LLM_* env vars)
npm run eval:e2e   # LLM + live HTTP adapter (requires API_* + LLM_* env vars)
```
Logs are written to `evals/logs/` only when `EVAL_LOGS_ENABLED=true`.

All scenarios assert **tool names and arguments** rather than downstream payloads. That keeps the suite stable while you iterate on adapters or datasets—the pass criterion is whether the agent invoked the correct flow with the right inputs.

## Connect from MCP clients

### Streamable HTTP (default)
1. Start the server:
   ```bash
   npm run serve
   ```
   By default it listens on `http://0.0.0.0:3030/mcp`; override `MCP_HTTP_HOST` and `MCP_HTTP_PORT` in `.env` if needed.
2. Point your MCP client at the HTTP endpoint. Most clients that understand the streamable HTTP transport accept a configuration similar to:
   ```json
   {
     "mcpServers": {
       "skyward-rewards": {
         "transport": {
           "type": "http",
           "url": "http://localhost:3030/mcp"
         }
       }
     }
   }
   ```
   Consult your client's documentation for the exact schema and how to attach authentication headers if required.

### Cursor and other stdio-only clients
Some clients (Cursor stable builds, older IDE integrations) still launch MCP servers as local child processes over stdio. Use the fallback script in those cases:
1. Install dependencies and build once:
   ```bash
   npm install
   npm run build
   ```
2. In `mcp.json`, keep the command-based entry but invoke `npm run serve:stdio`:
   ```json
   {
     "mcpServers": {
       "skyward-rewards": {
         "command": "npm",
         "args": ["run", "serve:stdio"],
         "cwd": "{{pwd}}/mcp-eval/mcp-server",
         "env": {
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```
   For situations where the server is not found, the startup script will be needed
   ```json
   {
     "mcpServers": {
       "skyward-rewards": {
         "command": "{{pwd}}/mcp-eval/mcp-server/scripts/start-mcp.sh"
       }
     }
   }
   ```
3. Restart Cursor and start the server from the MCP panel before sending tool calls.

## Adding a new flow tool
1. Implement the workflow in `src/tools/support.ts` (or a new module) with the minimal inputs required.
2. Export it through `src/tools/index.ts` with a descriptive name and JSON schema.
3. Add/adjust scenarios in `evals/scenarios/` to assert the final outcome.
4. Update the system prompt if the new flow introduces new concepts or required context.

With these pieces in place you can iterate on your MCP server like an app: flows hide API complexity, and evals ensure outcomes stay reliable.
