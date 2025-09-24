# MCP Server Template

This repository provides a starting point for building and validating Model Context Protocol (MCP) servers that sit in front of existing APIs. It focuses on:

- Designing intent-driven tools that hide API plumbing from downstream LLMs.
- Supplying a mock-friendly adapter layer so evals can run without live dependencies.
- Authoring scenario-based evals that verify tool selection and payload structure.

## Layout
- `mcp-server/` – Core MCP implementation (tool registry, adapters, eval runner, scenario catalog).
- `scaffolding/` – Architecture notes, market research, and changelog entries captured during template development.

## Quick start
```bash
# Install dependencies and build the MCP server
npm install --prefix mcp-server
npm run build --prefix mcp-server

# Run evals (mock mode by default; no external APIs required)
npm run eval:run --prefix mcp-server
```

To target a specific scenario or switch to live integrations, see the MCP README for adapter instructions.

## Why this template exists
- **Protocol-first mindset** – Tool design, not raw endpoints, should drive MCP interactions.
- **Deterministic evaluation** – Scenario files and mock adapters keep regressions visible without spinning up external systems.
- **Extensible adapters** – The HTTP abstraction can be replaced with real REST/GraphQL clients as you onboard production APIs.

Clone the template, extend the adapter layer to match your APIs, author domain-specific evals under `mcp-server/evals/scenarios/`, and hook the runner into CI to keep your MCP server honest.
