# Evals

Store evaluation scenarios, fixtures, and run artifacts here. Place scenario definitions in `scenarios/` and the JSONL logs or diff outputs from each run in `logs/`.

## Running Evals
- `npm run eval` – Executes scenarios in deterministic **tool mode** using whatever adapter is currently configured (mock by default).
- `npm run eval:llm` – Drives the same scenarios end-to-end with an LLM choosing tools. Supply `LLM_PROVIDER` or pass `--provider` to target OpenAI, OpenRouter, or Gemini and set `LLM_MODEL`, `LLM_PROVIDER_API_KEY`, and `LLM_PROVIDER_BASE_URL` (see `.env.example`).

### Conversation Scripts
When `--llm` is used the runner reads the optional `conversation` array from each scenario. These messages seed the chat session before the model begins issuing tool calls. Keep the conversation concise and representative of the support workflow you want to validate.

## Scenario Format
- `id` – Stable identifier for the run.
- `description` – Plain-language explanation of the goal.
- `conversation` – (Optional) Ordered chat messages (`role`, `content`) that seed LLM evals. Only used when running with `--llm`.
- `steps` – Ordered tool invocations the MCP server should execute. Each step supports:
  - `label` – Human-readable intent.
  - `tool` – The MCP tool name (e.g., `support.lookupCustomer`).
  - `arguments` – JSON arguments passed to the tool.
  - `capture` – Optional map of tokens to JSON path expressions used later via `{{token}}` interpolation.
  - `expect` – Assertions about the tool response:
    - `status` – Expected `success` or `error`.
    - `assert` – Array of checks (path + constraint such as `equals`, `contains`, `minLength`, `exists`, `isNull`).

## Current Scenarios (Loyalty Support Example)
- `support_lookup_customer` – Fetches a customer by email with recent activity snapshots; validates that responses include tier, balances, and audit metadata.
- `support_issue_goodwill` – Applies goodwill points and verifies the adjustment shows up in activity summaries.
- `support_redeem_reward` – Redeems a catalog reward for a customer and confirms the transaction details.
- `support_restock_reward` – Restocks limited inventory rewards and confirms catalog changes.
- `support_offer_assignment` – Assigns a promotional offer to a customer and verifies availability.
- `support_offer_claim` – Claims an assigned offer and confirms the associated reward fulfillment.

### Domain context
The bundled mock data models a loyalty program with three exemplar customers (Alicia, Marcus, Jasmine), a reward catalog (espresso upgrade, priority boarding, partner gift card), and promotional offers. Scenarios walk through common support workflows—issuing goodwill credits, assisting with reward redemption, and managing offer fulfillment—so you can see how to structure intent-driven tools around a realistic domain. Swap in your own dataset and scenarios to match your org.
- `support_lookup_customer` – Fetches a customer by email with recent activity snapshots.
- `support_issue_goodwill` – Applies goodwill points and verifies the adjustment shows up in activity summaries.
- `support_redeem_reward` – Redeems a catalog reward for a customer and confirms the transaction details.
- `support_restock_reward` – Restocks limited inventory rewards and confirms catalog changes.
- `support_offer_assignment` – Assigns a promotional offer to a customer and verifies availability.
- `support_offer_claim` – Claims an assigned offer and confirms the associated reward fulfillment.

Use these as templates when authoring additional support-focused evals (e.g., tier escalations, contact preference updates, or failed redemption recovery). The mock HTTP adapter keeps runs deterministic; swap in a live adapter when you are ready to speak to real APIs.
