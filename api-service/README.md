# Dungeon Master API Service

This service emulates a tabletop roleplaying Dungeon Master. It exposes domain-focused REST endpoints that narrate the story, track player progress, and curate in-world lore. Responses are mocked with light randomisation inside an in-memory campaign state so the surrounding MCP server can prototype interactions before we plug into a live game engine.

## Domains & Endpoints
### Story (`/story`)
- `GET /story` – Returns the active campaign arc and a quest board grouped by availability.
- `GET /story/quests` – Lists the full quest ledger with status, suggested challenges, and rewards.
- `PATCH /story/quests/:questId` – Updates quest metadata (title, objective, location, challenges, rewards) as the narrative evolves.
- `POST /story/quests/:questId/start` – Assigns an available quest to a player and marks it active.
- `POST /story/quests/:questId/complete` – Completes an active quest for the assigned player and rolls a fresh hook onto the board.

### Players (`/players`)
- `GET /players` – Lists active party members with stats, inventory, and quest progress.
- `GET /players/:playerId` – Returns the full character sheet for a specific adventurer.
- `PATCH /players/:playerId/stats` – Applies level ups or ability score tweaks (absolute values or adjustments).
- `POST /players/:playerId/items` – Grants a new item to the player, either by template ID or custom payload.
- `POST /players/:playerId/items/:itemId/use` – Consumes an item and emits the narrated effect.
- `DELETE /players/:playerId/items/:itemId` – Drops an item from the inventory (e.g., stash, trade, discard).

### World (`/world`)
- `GET /world` – Provides the current setting overview, active threats, and environmental cues.
- `GET /world/lore` – Surfaces lore entries the party can research between sessions.
- `POST /world/lore` – Creates new lore entries discovered during play.
- `GET /world/npcs` – Returns notable NPCs with motivations and relationship cues.
- `POST /world/npcs` – Registers an NPC on the fly (useful for improv encounters).
- `GET /world/items` – Shares the artifact manifest available to the MCP storytelling layer.
- `POST /world/items` – Adds new world items/artifacts so players can earn or discover them later.
  - Optional fields include `effect` to define the narrated outcome when the item is used.

All payloads come from a curated campaign state seeded at runtime. Mutating endpoints update that state so subsequent calls reflect the latest quest assignments, stat changes, and inventory choices.

## Development
1. `npm install`
2. `npm run dev` to launch the Express server with hot execution via `ts-node`.
3. Issue HTTP requests against `http://localhost:4000` (or the `PORT` env override) to explore the domains.

As we integrate with the real game engine, replace the mock generators with adapters that source canonical story state, player telemetry, and lore assets while keeping the endpoint contracts stable for upstream MCP tooling.
