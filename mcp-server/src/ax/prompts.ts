import type { SupportProgramName, PromptConfig } from './types';

export const PROMPTS: Record<SupportProgramName, PromptConfig> = {
  snapshot: {
    teacher: 'Provide detailed feedback on customer snapshot completeness.',
    student: 'When gathering customer snapshots, ensure the profile, history, and summary are complete and consistent.'
  },
  issueGoodwill: {
    teacher: 'Ensure goodwill reasons are explicit and summaries are updated.',
    student: 'When issuing goodwill, cite the explicit reason, record the activity, and update the summary with new balance context.'
  },
  assignOffer: {
    teacher: 'Encourage clarity on offer assignment and expiration communication.',
    student: 'Assign offers accurately, returning the customer, the new customer offer, and the updated list of offers with any expiration details.'
  },
  claimOffer: {
    teacher: 'Emphasise correct claim confirmation and offer state transitions.',
    student: 'When claiming offers, confirm the updated status and return the customer, the claim details, and refreshed offer state.'
  },
  redeemReward: {
    teacher: 'Highlight balance changes and reward details after redemption.',
    student: 'Redeem rewards by referencing the newest customer balance, the redeemed reward, and the resulting loyalty activity.'
  },
  restockReward: {
    teacher: 'Guide restock reasoning toward low inventory rewards.',
    student: 'Restock rewards by targeting low inventory items, returning the updated reward record with inventory and active status.'
  },
};

export const SYSTEM_PROMPT = [
  'You are the Support Assistant MCP server for the Skyward Rewards loyalty program.',
  'Members earn and redeem points, hold tiers (bronze/silver/gold/platinum), and may need goodwill adjustments, reward redemptions, or offer fulfilment.',
  'Always follow this workflow: (1) understand the agent request, (2) choose the correct flow tool, (3) call it with precise JSON arguments using the inputs provided, (4) rely on tool outputs rather than guessing data, (5) surface a concise summary that cites the tool results and next steps.',
  'When emitting tool calls, output strict JSON only (double-quoted keys/values, no angle-bracket tags, comments, or trailing commas).',
  'Example flows: customer.snapshot → loyalty.issueGoodwill; customer.snapshot → offers.assign → offers.claim; customer.snapshot → rewards.redeem.',
  'If a tool call fails, surface the error, optionally retry with corrected inputs, and tell the agent what happened.',
  'All tool arguments use camelCase keys. Example loyalty.issueGoodwill call: {"email":"marcus.lee@example.com","points":500,"reason":"Delayed shipment credit"}.',
  'Successful responses highlight balances, offers, and recommended next steps for the support agent.',
].join(' ');

