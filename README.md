# MCP Flow Template

This repository demonstrates how to treat an MCP server as an **application** that solves user tasks end-to-end for an agent. Instead of exposing raw REST endpoints, the server publishes a small set of intent-driven flow tools. An LLM (or human) calls one tool per outcome, and everything else—lookups, intermediate API calls, data shaping, **DSPy program orchestration**, and **GEPA optimisation**—happens inside the server via the Ax TypeScript DSPy implementation.

## Philosophy
- **DSPy-first flows** – each tool is defined as a DSPy Ax program with an explicit signature. Flow functions execute through Ax, so prompt / tool selection logic is type-safe and optimisable.
- **GEPA optimisation loops** – Ax GEPA (and GEPA-Flow) runs in-process against the same TypeScript flows, letting you evolve prompts and demos automatically using Ax optimisers and AxGEPA adapters.
- **Flow-first design** – each tool performs a complete business workflow (e.g., snapshot customer, issue goodwill, redeem reward). The agent never has to orchestrate individual API calls.
- **Adapter isolation** – HTTP plumbing lives in one place (`mcp-server/src/client/`). Swap the adapter to point at real services without touching the tools or evals.
- **Outcome-based evals** – scenarios assert the final state only. Extra tool calls are tolerated unless they fail, which mirrors how agents actually work.

## Repository layout
- `mcp-server/` – the reference MCP server, flow tools, runtime, Ax DSPy programs, and client adapter.
- `mcp-server/evals/` – scenario definitions and optional JSONL logs.
- `README.md` (this file) – describes the template philosophy.
- `mcp-server/README.md` – documents the server internals you’ll customise.
- `mcp-server/evals/README.md` – documents how scenarios and outcome checks are structured.

## Getting started
1. Clone the template.
2. Read `mcp-server/README.md` to wire the adapter, update the system prompt, implement your flow tools using Ax DSPy programs, and configure optimisation loops.
3. Use the eval harness to keep behaviour regression-free as you evolve your server and run GEPA fine-tuning.

## Evaluation modes
- `npm run eval` – deterministic harness that calls each flow directly through Ax DSPy programs and verifies expected tool arguments still succeed. GEPA optimisation runs are captured when enabled.
- `npm run eval:llm` – runs the scenarios with an LLM deciding which flow to call; assertions confirm that the model chose the correct tools and arguments, while optimisation traces are logged if GEPA is active.
- `npm run eval:e2e` – end-to-end run that combines the LLM harness with a live HTTP adapter so you can validate tool sequencing against real services, with optional GEPA loops for prompt tuning against live data.

The server supports OpenRouter, OpenAI, and local Ollama/YAMA providers. Set the `LLM_*` variables in `mcp-server/.env` (the runtime normalises `/v1/chat/completions` automatically).

Scenarios deliberately assert **tool** usage (names + arguments) instead of downstream API payloads so you can iterate on adapters, datasets, and DSPy optimisation loops without rewriting tests.

Treat this repo as a starting point: replace the mock adapter with production integrations, adapt the flows to your domain, and extend the evals to match your real support or operations scenarios.
