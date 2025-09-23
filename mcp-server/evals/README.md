# Evals

Store evaluation scenarios, fixtures, and run artifacts here. Place scenario definitions in `scenarios/` and the JSONL logs or diff outputs from each run in `logs/`.

## Scenario Format
- `id` – Stable identifier for the run.
- `description` – Plain-language explanation of the goal.
- `steps` – Ordered tool invocations the MCP server should execute. Each step supports:
  - `label` – Human-readable intent.
  - `tool` – The MCP tool name (e.g., `support.lookupCustomer`).
  - `arguments` – JSON arguments passed to the tool.
  - `capture` – Optional map of tokens to JSON path expressions used later via `{{token}}` interpolation.
  - `expect` – Assertions about the tool response:
    - `status` – Expected `success` or `error`.
    - `assert` – Array of checks (path + constraint such as `equals`, `contains`, `minLength`, `exists`, `isNull`).

## Current Scenarios
- `support_lookup_customer` – Fetches a customer by email with recent activity snapshots.
- `support_issue_goodwill` – Applies goodwill points and verifies the adjustment shows up in activity summaries.
- `support_redeem_reward` – Redeems a catalog reward for a customer and confirms the transaction details.
- `support_restock_reward` – Restocks limited inventory rewards and confirms catalog changes.
- `support_offer_assignment` – Assigns a promotional offer to a customer and verifies availability.
- `support_offer_claim` – Claims an assigned offer and confirms the associated reward fulfillment.

Use these as templates when authoring additional support-focused evals (e.g., tier escalations, contact preference updates, or failed redemption recovery).
