# Loyalty Support MCP Template

This repository demonstrates how to layer a Model Context Protocol (MCP) server over a loyalty/rewards REST API so an internal support assistant can resolve customer cases quickly. The emphasis is on designing intent-driven MCP tools (customer lookup, goodwill credits, reward management) and shipping evals that guarantee the MCP orchestrates the API correctly.

## What’s inside
- `api-service/` – Mock loyalty service built with Express/TypeScript. Endpoints handle customer profiles, balance adjustments, reward redemptions, and catalog management.
- `mcp-server/` – Support-focused MCP implementation exposing tools such as `support.lookupCustomer`, `support.issueGoodwill`, `support.redeemReward`, and `support.catalogSnapshot`, plus eval runners and scripted scenarios.
- `scaffolding/` – Market research, architecture notes, and changelog entries used while shaping the template.

## Getting started
1. Install dependencies and launch the loyalty API:
   ```bash
   npm install --prefix api-service
   npm run dev --prefix api-service
   ```
2. Implement or adapt the MCP tools under `mcp-server/src/` (the provided code already wires the support flows to the API).
3. Run the MCP evals to verify behaviour:
   ```bash
   npm install --prefix mcp-server
   npm run build --prefix mcp-server
   npm run eval:run --prefix mcp-server
   ```
4. Inspect eval outputs in `mcp-server/evals/logs/` to confirm tool usage, customer balances, and catalog updates match expectations.

## Evaluation philosophy
Evals are the MCP equivalent of integration tests. Aim to:
- Drive realistic support flows (account lookup, goodwill credits, reward assistance, inventory adjustments).
- Assert on tool selection, arguments, and structured payloads (balances, activity logs, reward metadata).
- Log results alongside the MCP code so regressions are immediately visible in CI.

Current scenarios cover:
- `support_lookup_customer`
- `support_issue_goodwill`
- `support_redeem_reward`
- `support_restock_reward`
- `support_offer_assignment`
- `support_offer_claim`

Use them as blueprints when growing coverage (failed redemptions, tier escalations, contact preference updates, etc.).

## Contributing
Updates are welcome. Keep the READMEs, tool documentation, and eval scenarios in sync so future contributors can rely on accurate guidance and tests.
