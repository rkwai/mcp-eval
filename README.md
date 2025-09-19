# MCP Evaluation Template

This repository provides a template for building a Model Context Protocol (MCP) server on top of existing RESTful API endpoints and evaluating the tool-calling behavior of that server. The focus here is on demonstrating how to stand up a compliant MCP server quickly and how to design reliable evals that validate it is making the right calls at the right time.

## Why this template exists
- **MCP-first perspective:** Many teams already have REST APIs. This template shows how to expose those capabilities through an MCP server without rewriting business logic.
- **Evaluation-focused:** Tool integration is only useful if you can prove it behaves correctly. The sample eval patterns here illustrate how to measure that behavior.
- **Reusable patterns:** The project layout, configuration, and scripts aim to give you guardrails for new MCP services so you can start from a known-good baseline.

## Repository layout
- `api-service/` – Domain logic and REST API surface that powers tool implementations.
- `mcp-server/` – MCP server, prompt logic, and embedded eval suites (`mcp-server/evals/`).
- `scaffolding/` – Market research, references, and other helper assets to guide implementation.

## Getting started
1. Install your preferred MCP tooling (e.g., `mcp` CLI or integration SDK) and clone this repository.
2. Build or adapt your REST API inside `api-service/`, keeping schemas aligned with the tools you plan to expose.
3. Implement the MCP server in `mcp-server/`, wiring tool definitions to the API service and maintaining prompt strategy alongside eval assets.
4. Author eval scenarios in `mcp-server/evals/scenarios/`, run them against the server, and review the emitted logs in `mcp-server/evals/logs/` to confirm correct tool usage.

## Evaluation philosophy
Effective evals for MCP servers should:
- Drive the server through realistic conversational flows.
- Assert on both the tool selected and the arguments passed.
- Capture and inspect artifacts to aid debugging when discrepancies appear.
- Run automatically (CI, pre-merge hooks) to prevent regressions.

## Next steps
- Flesh out the API and MCP server implementations so they reflect your real REST surface area.
- Add scripted evals (e.g., TypeScript harness, pytest + jsonschema, or a custom runner) that validate tool-calling behavior.
- Document any non-obvious setup steps or environment variables once they are known.

## Contributing
Issues and pull requests are welcome. Please include updates to documentation and eval coverage when modifying the MCP server so future contributors can rely on accurate guidance and tests.
