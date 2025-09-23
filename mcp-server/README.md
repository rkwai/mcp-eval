# Support Assistant MCP Server

This MCP server helps an internal customer support team resolve loyalty program requests quickly. Instead of exposing raw REST endpoints, it delivers higher-level tools that triage customer accounts, grant goodwill points, trigger reward redemptions, and summarize recent activity by orchestrating the `../api-service/` loyalty APIs.

## Core Responsibilities
- **Customer insight orchestration** – Provide tools such as `support.lookupCustomer` and `support.activitySummary` that gather profile, balances, and recent transactions in one call.
- **Goodwill adjustments** – Offer guardrailed actions like `support.issueGoodwill` to apply point credits with consistent metadata.
- **Reward management** – Allow agents to redeem catalog rewards or extend inventory (`support.redeemReward`, `support.restockReward`) while tracking fulfillment.
- **Guided resolution flows** – Combine multiple API calls into single intent-based tools so agents stay focused on outcomes (e.g., status checks, tier upgrades) rather than endpoint choreography.

## Structure
- `src/` – MCP server bootstrap, support-oriented tool contracts, and adapters that compose the loyalty API.
- `evals/scenarios/` – Support playbooks that assert the MCP server can perform key support tasks end to end.
- `evals/logs/` – Historical eval output for regression tracking.
- `scripts/` – Helper scripts (e.g., eval runners) tailored to this MCP surface.

## Tool Design Principles
1. **Intent over plumbing** – Tools should mention agent actions (`support.lookupCustomer`, `support.issueGoodwill`, `support.redeemReward`) rather than the REST endpoints they bundle.
2. **Bundled insight payloads** – Responses include customer summaries, loyalty balances, and provenance hints so agents can act immediately.
3. **Guardrails** – Validate input (minimum metadata, confirmation flags) before calling the API to prevent accidental over-crediting or duplicate redemptions.

### Planned Tool Set
- `support.lookupCustomer` – Fetch profile, balances, recent history, and tier suggestions.
- `support.activitySummary` – Aggregate last N activities and flag anomalies (large redemptions, repeated failures).
- `support.issueGoodwill` – Add points with standardized metadata (reason, agent, channel).
- `support.redeemReward` – Attempt a reward redemption and summarize results (stock, confirmation).
- `support.catalogSnapshot` – Provide a filtered view of rewards inventory for quick answers.
- `support.restockReward` – Increase inventory when support grants exceptions.
- `support.offerCatalog` / `support.customerOffers` – Review global promotions and customer-specific eligibility.
- `support.assignOffer` / `support.claimOffer` – Target offers to customers and fulfill them with audit-friendly metadata.

## Development Flow
1. Start the loyalty API: `npm run dev --prefix ../api-service`.
2. Implement MCP tools under `src/tools/`, using the loyalty adapters to orchestrate the API.
3. Run `npm run eval:run` to drive the support scenarios. Optionally target a single scenario via `npm run eval:run -- --scenario support_issue_goodwill`.
4. Inspect logs in `evals/logs/` or pipe results into your support QA dashboard.

Keep evals and tooling aligned with frontline workflows (refunds, tier escalations, failed redemptions) so the MCP server remains a reliable support copilot.
