import type { SupportProgramName, PromptConfig } from './types';

export const PROMPTS: Record<SupportProgramName, PromptConfig> = {
  snapshot: {
    teacher: 'Require the assistant to return {"payload":{customer,history,summary}} and flag any missing nested keys.',
    student: 'Reply with {"payload":{"customer":{...},"history":[...],"summary":{...}}} and nothing else.'
  },
  issueGoodwill: {
    teacher: 'Ensure the output is {"payload":{customer,activity,summary}} with valid JSON bodies.',
    student: 'Return {"payload":{"customer":{...},"activity":{...},"summary":{...}}}.'
  },
  assignOffer: {
    teacher: 'Check that responses take the form {"payload":{customer,customerOffer,offers}}.',
    student: 'Respond with {"payload":{"customer":{...},"customerOffer":{...},"offers":[...]}}.'
  },
  claimOffer: {
    teacher: 'Demand {"payload":{customer,claim,offers}}; highlight gaps.',
    student: 'Return {"payload":{"customer":{...},"claim":{...},"offers":[...]}} only.'
  },
  redeemReward: {
    teacher: 'Verify the assistant outputs {"payload":{customer,reward,activity}}.',
    student: 'Produce {"payload":{"customer":{...},"reward":{...},"activity":{...}}}.'
  },
  restockReward: {
    teacher: 'Require {"payload":{reward}} where reward is the updated record.',
    student: 'Respond with {"payload":{"reward":{...}}}.'
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
