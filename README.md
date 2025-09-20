# Dungeon Master MCP Template

This repository shows how to layer a Model Context Protocol (MCP) server over an existing REST API so a language model can run a lightweight Dungeon Master experience. The emphasis is on designing application-grade MCP tools and authoring evals that guarantee the MCP orchestrates the API correctly.

## What’s inside
- `api-service/` – Express/TypeScript API that models a campaign world. Endpoints cover story flow, party management, and world-building with mutators for lore, NPCs, and artifacts.
- `mcp-server/` – MCP implementation that exposes player-friendly tools such as `session.startAdventure`, `session.progressAdventure`, and world creation helpers. Includes eval runners and scripted scenarios.
- `scaffolding/` – Market research, architecture notes, and changelog entries used while shaping the template.

## Getting started
1. Install dependencies and start the API service:
   ```bash
   npm install --prefix api-service
   npm run dev --prefix api-service
   ```
2. Implement or adapt MCP tools under `mcp-server/src/`. The provided code already wires the session/world tools to the API.
3. Run the MCP evals to verify behaviour:
   ```bash
   npm install --prefix mcp-server
   npm run build --prefix mcp-server
   # execute all scenarios (ensure the API service is running first)
   npm run eval:run --prefix mcp-server
   ```
4. Inspect eval outputs in `mcp-server/evals/logs/` to confirm tool usage, narration strings, and quest rotations meet expectations.

## Evaluation philosophy
Evals are the MCP equivalent of integration tests. Aim to:
- Drive realistic player flows (start, recruit allies, craft artifacts, uncover lore, multi-turn progression).
- Assert on tool selection, arguments, and narrative payloads.
- Log results alongside the MCP code so regressions are immediately visible in CI.

Current scenarios cover:
- `player_adventure_opening`
- `player_requests_support`
- `player_claims_artifact`
- `player_discovers_lore`
- `player_extended_session`

Use them as blueprints when growing coverage (e.g., multi-party sessions, error paths, or sandboxed quest branches).

## Contributing
Updates are welcome. Please keep the READMEs, tool documentation, and eval scenarios in sync so future contributors can trust the Dungeon Master flows and extend them confidently.
