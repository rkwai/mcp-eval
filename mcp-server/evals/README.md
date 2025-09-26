# Evals

This directory stores the flow-level evaluation scenarios. Each scenario checks that a single MCP tool satisfies a support request end-to-end. We assert only the final outcome—extra tool calls are tolerated unless they fail.

## Running evals
- `npm run eval` – deterministic mode. Calls each flow directly with the mock adapter (or your live adapter once you swap it in).
- `npm run eval:llm` – OpenRouter LLM drives the same scenarios. The harness only verifies that the required flow tool appears somewhere in the sequence and that the assertions pass.
- Optional logging: set `EVAL_LOGS_ENABLED=true` in `.env` to write JSONL transcripts + tool-call summaries to `evals/logs/`.
- When the mock adapter is active, state is reset before every scenario (and for each LLM prompt variant) so runs stay independent.

## Scenario format
- `id` – Unique identifier.
- `description` – What outcome the scenario validates.
- `conversation` – Array of chat messages. Add multiple user turns to capture alternate phrasings for the same task; the LLM harness executes each user-only variant as an independent run.
- `steps` – Outcome checks for a single flow tool:
  - `tool` – flow tool name (e.g., `loyalty.issueGoodwill`).
  - `arguments` – JSON payload passed to the flow.
  - `expect.status` – Expected success/error.
  - `expect.assert` – Assertions against the response (path + constraint).

## Current scenarios (Skyward Rewards)
- `support_lookup_customer` → `customer.snapshot`
- `support_issue_goodwill` → `loyalty.issueGoodwill`
- `support_offer_assignment` → `offers.assign`
- `support_offer_claim` → `offers.claim`
- `support_redeem_reward` → `rewards.redeem`
- `support_restock_reward` → `rewards.restock`

Use these as templates: keep conversations realistic, call a single flow tool, and assert the business outcome—not the intermediate steps. Adjust or replace the mock adapter so the flows target your real systems and extend the scenarios to cover your critical workflows.
