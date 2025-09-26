# Repository Guidelines

## Project Structure & Module Organization
- `mcp-server/src/` – TypeScript source for the MCP application. Key subfolders:
  - `client/` holds HTTP adapter code (`api.ts`, `mock-adapter.ts`). Swap the mock adapter for production integrations.
  - `tools/` exposes flow-level MCP tools; add new workflows here and register them in `index.ts`.
  - `runtime/` contains the stdio entry point, server bootstrap, and LLM session harness.
- `mcp-server/evals/` – Scenario JSON, logs, and documentation for outcome-based evaluations.
- `mcp-server/scripts/` – CLI utilities such as the eval harness (`run-evals.ts`) and log reporter.
- Root `README.md`, `mcp-server/README.md`, and `mcp-server/evals/README.md` outline philosophy, internals, and eval usage respectively.

## Build, Test, and Development Commands
- `npm run build` – Compile the MCP server with TypeScript.
- `npm run serve` – Launch the MCP server over stdio (uses the configured adapter).
- `npm run eval` – Execute deterministic flow scenarios against the current adapter.
- `npm run eval:llm` – Run the same scenarios with an OpenRouter LLM driving tool calls (`LLM_*` env vars required).
- `npm run eval:report` – Summarise JSONL logs when `EVAL_LOGS_ENABLED=true`.

## Coding Style & Naming Conventions
- TypeScript only; use 2-space indentation and trailing commas where it improves diffs.
- Export flow functions in `camelCase`; MCP tool identifiers follow `namespace.intent` (e.g., `loyalty.issueGoodwill`).
- Keep flow logic in `src/tools/support.ts` (or a similarly named module) and avoid inline HTTP calls elsewhere.
- No automated formatter is enforced—mirror surrounding style and keep comments concise.

## Testing Guidelines
- Deterministic evals (`npm run eval`) are the canonical regression check; ensure new flows ship with at least one scenario in `mcp-server/evals/scenarios/`.
- LLM evals are optional but recommended before release; document any required environment variables in PR descriptions.
- Name scenario files `support_<task>.json` and keep conversations realistic to how agents speak.

## Commit & Pull Request Guidelines
- Commit messages should be present-tense and short (e.g., `Add reward restock flow`). Squash commits when feature-level clarity improves history.
- Pull requests must include: summary of changes, affected commands (e.g., `npm run eval`), and any new scenarios or env variables. Attach eval logs or screenshots when behaviour changes are significant.
