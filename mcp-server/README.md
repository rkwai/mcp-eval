# Dungeon Master MCP Server

This Model Context Protocol server turns the lower-level REST endpoints from `../api-service/` into an application-grade storytelling agent. Its goal is to let an LLM run cinematic tabletop experiences end to end—driving plot beats, reacting to player state, managing quests, and weaving world lore—without leaking raw transport details.

## Core Responsibilities
- **Intentful tool design** – Provide high-level actions such as `session.startAdventure`, `session.progressAdventure`, `story.beginQuest`, `story.completeQuest`, `party.adjustStats`, `party.grantItem`, and `world.overview` that compose multiple API calls when needed.
- **Quest & inventory orchestration** – Coordinate lifecycle updates across `/story/quests`, `/players/:id/stats`, and `/players/:id/items` so the narrative stays in sync with party progress.
- **Narrative state management** – Maintain session context (active arc, quest cadence, NPC dispositions) so the LLM can reason about consequences between turns.
- **Eval-driven confidence** – Ship golden conversations and regression logs to prove the MCP server is orchestrating calls correctly and following Dungeon Master safety rails.

## Structure
- `src/` – MCP server bootstrap, tool contracts, and adapters that orchestrate multi-step story flows.
- `evals/scenarios/` – Scripted sessions the LLM should pass, covering player-driven openings, action responses, quest lifecycle, stat adjustments, inventory usage, and world reveals.
- `evals/logs/` – Output from recent eval runs for change tracking.
- `scripts/` – Utility CLIs (e.g., eval runners, report aggregators) tailored to this MCP surface.

## Tool Design Principles
1. **Wrap intents, not endpoints** – Each tool should speak in GM-centric verbs, even if it chains `POST /story/quests/:id/start` with `GET /players/:id` under the hood.
2. **Bundle reasoning hints** – Return structured payloads and short narrative prompts to keep the model grounded in dungeon master voice.
3. **Surface guardrails** – Include safety metadata (session tone, content flags) so the orchestrating LLM stays inside agreed tone boundaries.

## Key API Touchpoints
- **Story board** – `GET /story`, `GET /story/quests`, `POST /story/quests/:questId/start`, `POST /story/quests/:questId/complete`.
- **Party management** – `GET /players`, `GET /players/:playerId`, `PATCH /players/:playerId/stats`.
- **Inventory actions** – `POST /players/:playerId/items`, `POST /players/:playerId/items/:itemId/use`, `DELETE /players/:playerId/items/:itemId`.
- **World context** – `GET /world`, `POST /world/lore`, `POST /world/npcs`, `POST /world/items` to improvise lore/NPCs/items, plus the read endpoints `GET /world`, `GET /world/lore`, `GET /world/npcs`, `GET /world/items`.

### Available Tools
- `session.startAdventure` / `session.progressAdventure`
- `story.listBoard` / `story.listQuests`
- `story.beginQuest` / `story.completeQuest`
- `party.list` / `party.inspect`
- `party.adjustStats`
- `party.grantItem` / `party.useItem` / `party.dropItem`
- `world.overview` / `world.lore` / `world.npcs` / `world.items`
- `world.createLore` / `world.createNpc` / `world.createItem` (supports optional `effect` narration)

## Development Flow
1. Start the API layer: `npm run dev --prefix ../api-service`.
2. Run the MCP server locally (for example via `npm run dev` once the package scripts are set up) and point it at the API service base URL.
3. Execute the evals to validate new scenarios or tool changes (API service must be running):
   - `npm run eval:run` – Runs all scripted scenarios with assertions.
   - `npm run eval:run -- --scenario player_adventure_opening` – Runs a single scenario.
   - `npm run eval:report` – Summarises the most recent eval log output.

As the real game engine comes online, swap the mock adapters for production data sources while keeping the application-level tool interface stable for connected clients.
