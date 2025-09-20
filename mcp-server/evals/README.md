# Evals

Store evaluation scenarios, fixtures, and run artifacts here. Place scenario definitions in `scenarios/` and the JSONL logs or diff outputs from each run in `logs/`.

## Scenario Format
- `id` – Stable identifier for the run.
- `description` – Plain-language explanation of the goal.
- `preconditions` – Optional metadata about required services, seed data, or assumptions.
- `steps` – Ordered tool invocations the MCP server should execute. Each step supports:
  - `label` – Human-readable intent.
  - `tool` – The MCP tool name (for example `story.beginQuest`).
  - `arguments` – JSON arguments passed to the tool.
  - `capture` – Optional map of tokens to JSON pointer-like expressions used later via `{{token}}` interpolation.
  - `expect` – Assertions about the tool response. The reference harness recognises:
    - `status` – `success` or `error` expectation.
    - `assert` – Array of checks (`path` + constraint such as `exists`, `equals`, `contains`, or `minLength`).

### Available Scenarios
- `player_adventure_opening` – Player starts the session and takes an initial action.
- `player_requests_support` – Player recruits an NPC ally before advancing.
- `player_claims_artifact` – Player manifests, wields, and leverages a new artifact.
- `player_discovers_lore` – Player records fresh lore and uses it to progress the quest.
- `player_extended_session` – Player executes three sequential actions to prove multi-turn quest continuity.

Use these as templates when authoring additional evals (for example, multi-party runs or failure edge cases).
