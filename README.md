# MCP Flow Template

This repository demonstrates how to treat an MCP server as an **application** that solves user tasks end-to-end for an agent. Instead of exposing raw REST endpoints, the server publishes a small set of intent-driven flow tools. An LLM (or human) calls one tool per outcome, and everything else—lookups, intermediate API calls, data shaping—happens inside the server.

## Philosophy
- **Flow-first design** – each tool performs a complete business workflow (e.g., snapshot customer, issue goodwill, redeem reward). The agent never has to orchestrate individual API calls.
- **Adapter isolation** – HTTP plumbing lives in one place (`mcp-server/src/client/`). Swap the adapter to point at real services without touching the tools or evals.
- **Outcome-based evals** – scenarios assert the final state only. Extra tool calls are tolerated unless they fail, which mirrors how agents actually work.

## Repository layout
- `mcp-server/` – the reference MCP server, flow tools, runtime, and client adapter.
- `mcp-server/evals/` – scenario definitions and optional JSONL logs.
- `README.md` (this file) – describes the template philosophy.
- `mcp-server/README.md` – documents the server internals you’ll customise.
- `mcp-server/evals/README.md` – documents how scenarios and outcome checks are structured.

## Getting started
1. Clone the template.
2. Read `mcp-server/README.md` to wire the adapter, update the system prompt, and implement your flow tools.
3. Use the eval harness to keep behaviour regression-free as you evolve your server.

## Evaluation modes
- `npm run eval` – deterministic harness that calls each flow directly and verifies expected tool arguments still succeed.
- `npm run eval:llm` – runs the scenarios with an LLM deciding which flow to call; assertions confirm that the model chose the correct tools and arguments.
- `npm run eval:e2e` – end-to-end run that combines the LLM harness with a live HTTP adapter so you can validate tool sequencing against real services.

Scenarios deliberately assert **tool** usage (names + arguments) instead of downstream API payloads so you can iterate on adapters and datasets without rewriting tests.

Treat this repo as a starting point: replace the mock adapter with production integrations, adapt the flows to your domain, and extend the evals to match your real support or operations scenarios.
