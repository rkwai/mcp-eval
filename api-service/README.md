# Loyalty Rewards API Service

This mock service models the core surfaces that power a customer loyalty program. It exposes REST endpoints for managing customer profiles, tracking point balances, redeeming rewards, and auditing activity. Responses are persisted in-memory so the surrounding MCP server or test harness can iterate quickly without external dependencies.

## Domains & Endpoints
### Customers (`/customers`)
- `GET /customers` – Returns all customers with summary balances and tier assignments.
- `POST /customers` – Creates a new customer with basic profile data and optional starting tier/points.
- `GET /customers/:customerId` – Retrieves the full profile, balances, and recent activity for a single customer.
- `PATCH /customers/:customerId` – Updates contact information, preferred communication channel, or marketing opt-in flags.

### Loyalty Balances (`/customers/:customerId`)
- `POST /customers/:customerId/earn` – Grants loyalty points from a qualifying event (purchase, referral, campaign, etc.).
- `POST /customers/:customerId/redeem` – Redeems an available reward, deducts points, and emits the reward fulfillment payload.
- `GET /customers/:customerId/history` – Lists chronological earning/redemption entries with metadata about the source event.

### Rewards Catalog (`/rewards`)
- `GET /rewards` – Lists reward items with the points required to redeem each.
- `POST /rewards` – Adds a reward to the catalog (useful for campaign-specific perks during testing).
- `PATCH /rewards/:rewardId` – Updates the cost, inventory, or active window for an existing reward (including optional fulfillment instructions).

### Offers (`/offers` & `/customers/:customerId/offers`)
- `GET /offers` – Lists global campaign offers that can be targeted to customers.
- `POST /offers` – Creates a new offer (links to a reward, defines validity, optional inventory).
- `PATCH /offers/:offerId` – Updates an offer’s schedule, description, inventory, or active status.
- `GET /customers/:customerId/offers` – Lists offers assigned to a customer, including status (`available`, `claimed`, `expired`).
- `POST /customers/:customerId/offers` – Assigns an offer to a customer (for proactive outreach or remediation).
- `POST /customers/:customerId/offers/:customerOfferId/claim` – Marks an assigned offer as claimed, fulfills the linked reward, and records activity without deducting loyalty points.

All endpoints operate against a shared in-memory datastore seeded with sample customers, rewards, and transaction history. Mutating endpoints update that state so subsequent calls reflect the changes.

## Development
1. `npm install`
2. `npm run dev` to launch the Express server with hot execution via `ts-node`.
3. Hit `http://localhost:4000` (or override with `HOST`/`PORT`) to exercise the loyalty endpoints.

## Data Model Notes
- **Customers** track profile fields (`name`, `email`, `tier`), loyalty balances, communication preferences, and cumulative lifetime points.
- **Transactions** capture both earn and redeem events with sources, channel tags, and point delta (+/-).
- **Rewards** include catalog metadata, required points, stock counts, and optional fulfillment instructions.
- **Offers** reference rewards, encode eligibility windows/quantities, and keep per-customer assignment status (`available`, `claimed`, `expired`). Complementary helper endpoints manage assignment and fulfillment without deducting loyalty points.

Extend or replace the mock data to align with your real loyalty ecosystem when wiring an MCP server or integration tests against this service. Offers are especially useful for testing targeted campaigns—adapt the sample fulfillment logic to mirror production behaviour if needed.
