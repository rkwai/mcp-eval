import * as supportTools from './support';

export type ToolName =
  | 'support.lookupCustomer'
  | 'support.activitySummary'
  | 'support.issueGoodwill'
  | 'support.redeemReward'
  | 'support.catalogSnapshot'
  | 'support.restockReward'
  | 'support.offerCatalog'
  | 'support.customerOffers'
  | 'support.assignOffer'
  | 'support.claimOffer';

export type ToolArguments = Record<string, unknown>;
export type ToolRunner = (args: ToolArguments) => Promise<unknown>;

const TOOL_REGISTRY: Record<ToolName, ToolRunner> = {
  'support.lookupCustomer': async (args) =>
    supportTools.lookupCustomer({
      customerId: optionalString(args.customerId),
      email: optionalString(args.email),
      includeHistory: optionalBoolean(args.includeHistory) ?? true,
      historyLimit: optionalNumber(args.historyLimit),
    }),
  'support.activitySummary': async (args) =>
    supportTools.activitySummary({
      customerId: requireString(args.customerId, 'customerId'),
      limit: optionalNumber(args.limit),
    }),
  'support.issueGoodwill': async (args) =>
    supportTools.issueGoodwill({
      customerId: requireString(args.customerId, 'customerId'),
      points: requireNumber(args.points, 'points'),
      reason: requireString(args.reason, 'reason'),
      channel: optionalString(args.channel),
    }),
  'support.redeemReward': async (args) =>
    supportTools.redeemReward({
      customerId: requireString(args.customerId, 'customerId'),
      rewardId: requireString(args.rewardId, 'rewardId'),
      channel: optionalString(args.channel),
      note: optionalString(args.note),
    }),
  'support.catalogSnapshot': async (args) =>
    supportTools.catalogSnapshot({
      onlyActive: optionalBoolean(args.onlyActive) ?? true,
      minInventory: optionalNumber(args.minInventory),
      maxCost: optionalNumber(args.maxCost),
    }),
  'support.restockReward': async (args) =>
    supportTools.restockReward({
      rewardId: requireString(args.rewardId, 'rewardId'),
      inventoryDelta: requireNumber(args.inventoryDelta, 'inventoryDelta'),
      active: optionalBoolean(args.active),
    }),
  'support.offerCatalog': async (args) =>
    supportTools.offerCatalog({
      onlyActive: optionalBoolean(args.onlyActive) ?? true,
    }),
  'support.customerOffers': async (args) =>
    supportTools.customerOffers({
      customerId: requireString(args.customerId, 'customerId'),
      includeExpired: optionalBoolean(args.includeExpired),
    }),
  'support.assignOffer': async (args) =>
    supportTools.assignOffer({
      customerId: requireString(args.customerId, 'customerId'),
      offerId: requireString(args.offerId, 'offerId'),
      expiresAt: optionalString(args.expiresAt),
    }),
  'support.claimOffer': async (args) =>
    supportTools.claimOffer({
      customerId: requireString(args.customerId, 'customerId'),
      customerOfferId: requireString(args.customerOfferId, 'customerOfferId'),
    }),
};

export function resolveTool(name: ToolName): ToolRunner {
  const runner = TOOL_REGISTRY[name];
  if (!runner) {
    throw new Error(`Unsupported tool: ${name}`);
  }
  return runner;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Expected ${field} to be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return undefined;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Expected ${field} to be a number.`);
  }
  return value;
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  return undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
}
