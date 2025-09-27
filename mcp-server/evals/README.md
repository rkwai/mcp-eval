# Evals

This directory stores the flow-level evaluation scenarios. Each scenario checks that a single MCP tool satisfies a support request end-to-end. Assertions focus on **which tool was invoked and the arguments it received**; response payloads are treated as opaque so adapter tweaks or dataset changes do not force scenario rewrites.

## Running evals
- `npm run eval` – deterministic mode. Calls each flow directly with the mock adapter (or your live adapter once you swap it in).
- `npm run eval:llm` – OpenRouter LLM drives the same scenarios. The harness verifies that the required flow tool appears and that the arguments match the scenario definition.
- `npm run eval:e2e` – LLM-driven run that also swaps in the live HTTP adapter (configure `API_*` and `LLM_*` variables first). Use this to validate tool sequencing against real services.
- Optional logging: set `EVAL_LOGS_ENABLED=true` in `.env` to write JSONL transcripts + tool-call summaries to `evals/logs/`.
- The harness re-instantiates the mock adapter before every scenario (and each LLM prompt variant) so runs stay independent without explicit state resets.

## Scenario format
- `id` – Unique identifier.
- `description` – What outcome the scenario validates.
- `conversation` – Array of chat messages. Add multiple user turns to capture alternate phrasings for the same task; the LLM harness executes each user-only variant as an independent run.
- `steps` – Outcome checks for a single flow tool:
  - `tool` – flow tool name (e.g., `loyalty.issueGoodwill`).
  - `arguments` – JSON payload the tool must receive. The LLM harness enforces key/value equality (extra arguments are allowed).
  - `expect.status` (optional) – Expected success/error, defaults to `success`.

## Current scenarios (Skyward Rewards)
- `support_lookup_customer` → `customer.snapshot`
- `support_issue_goodwill` → `loyalty.issueGoodwill`
- `support_offer_assignment` → `offers.assign`
- `support_offer_claim` → `offers.claim`
- `support_redeem_reward` → `rewards.redeem`
- `support_restock_reward` → `rewards.restock`

Use these as templates: keep conversations realistic, call a single flow tool, and assert the business intent by demanding the right tool + arguments. Adjust or replace the mock adapter so the flows target your real systems and extend the scenarios to cover your critical workflows.
