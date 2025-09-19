# MCP Server

Holds the Model Context Protocol server logic, prompt configuration, and the eval suites that ensure correct tool usage. This layer should consume the domain-specific capabilities exposed by `../api-service/`.

## Structure
- `src/` – MCP tool definitions, prompt templates, and adapters that call into the API service.
- `evals/scenarios/` – Conversation definitions and expectations for tool usage.
- `evals/logs/` – JSONL logs generated from eval runs; compare against golden transcripts to catch regressions.

Run your local or CI eval harness from this directory so artifacts land alongside the MCP code they exercise.
