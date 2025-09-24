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

type JsonSchema = {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: unknown[];
  items?: JsonSchema | JsonSchema[];
  format?: string;
};

export type ToolSchema = JsonSchema;

export interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: JsonSchema;
}

interface ToolConfig extends ToolDefinition {
  runner: ToolRunner;
}

const TOOL_CONFIG: Record<ToolName, ToolConfig> = {
  'support.lookupCustomer': {
    name: 'support.lookupCustomer',
    description:
      'Retrieve a customer profile (and optional recent history) by loyalty ID or email for support triage.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        customerId: {
          type: 'string',
          description: 'Known loyalty identifier if already available.',
        },
        email: {
          type: 'string',
          description: 'Customer email when ID is unknown.',
          format: 'email'
        },
        includeHistory: {
          type: 'boolean',
          description: 'Include recent activity ledger in the response.',
        },
        historyLimit: {
          type: 'number',
          description: 'Trim history to the latest N records.',
        },
      },
    },
    runner: async (args) =>
      supportTools.lookupCustomer({
        customerId: optionalString(args.customerId),
        email: optionalString(args.email),
        includeHistory: optionalBoolean(args.includeHistory) ?? true,
        historyLimit: optionalNumber(args.historyLimit),
      }),
  },
  'support.activitySummary': {
    name: 'support.activitySummary',
    description: 'Summarise a customer loyalty activity stream for quick diagnostics.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['customerId'],
      properties: {
        customerId: {
          type: 'string',
          description: 'Customer loyalty identifier to summarise.',
        },
        limit: {
          type: 'number',
          description: 'Limit the number of records analysed.',
        },
      },
    },
    runner: async (args) =>
      supportTools.activitySummary({
        customerId: requireString(args.customerId, 'customerId'),
        limit: optionalNumber(args.limit),
      }),
  },
  'support.issueGoodwill': {
    name: 'support.issueGoodwill',
    description: 'Issue goodwill loyalty points to resolve support escalations.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['customerId', 'points', 'reason'],
      properties: {
        customerId: {
          type: 'string',
          description: 'Recipient loyalty identifier.',
        },
        points: {
          type: 'number',
          description: 'Positive integer points to grant.',
        },
        reason: {
          type: 'string',
          description: 'Internal memo about why goodwill was issued.',
        },
        channel: {
          type: 'string',
          description: 'Channel through which goodwill is communicated (email, phone, etc.).',
        },
      },
    },
    runner: async (args) =>
      supportTools.issueGoodwill({
        customerId: requireString(args.customerId, 'customerId'),
        points: requireNumber(args.points, 'points'),
        reason: requireString(args.reason, 'reason'),
        channel: optionalString(args.channel),
      }),
  },
  'support.redeemReward': {
    name: 'support.redeemReward',
    description: 'Redeem a loyalty reward on behalf of a customer.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['customerId', 'rewardId'],
      properties: {
        customerId: {
          type: 'string',
          description: 'Loyalty identifier of the redeemer.',
        },
        rewardId: {
          type: 'string',
          description: 'Reward identifier to redeem.',
        },
        channel: {
          type: 'string',
          description: 'Fulfilment channel (support, digital, etc.).',
        },
        note: {
          type: 'string',
          description: 'Optional fulfilment note for audit trail.',
        },
      },
    },
    runner: async (args) =>
      supportTools.redeemReward({
        customerId: requireString(args.customerId, 'customerId'),
        rewardId: requireString(args.rewardId, 'rewardId'),
        channel: optionalString(args.channel),
        note: optionalString(args.note),
      }),
  },
  'support.catalogSnapshot': {
    name: 'support.catalogSnapshot',
    description: 'Inspect loyalty reward catalog availability and filters.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        onlyActive: {
          type: 'boolean',
          description: 'Restrict to active rewards.',
        },
        minInventory: {
          type: 'number',
          description: 'Filter rewards with at least this inventory.',
        },
        maxCost: {
          type: 'number',
          description: 'Upper bound cost to filter by.',
        },
      },
    },
    runner: async (args) =>
      supportTools.catalogSnapshot({
        onlyActive: optionalBoolean(args.onlyActive) ?? true,
        minInventory: optionalNumber(args.minInventory),
        maxCost: optionalNumber(args.maxCost),
      }),
  },
  'support.restockReward': {
    name: 'support.restockReward',
    description: 'Adjust reward inventory or activation status.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['rewardId', 'inventoryDelta'],
      properties: {
        rewardId: {
          type: 'string',
          description: 'Identifier of the reward to update.',
        },
        inventoryDelta: {
          type: 'number',
          description: 'Quantity to set inventory to (mock adapter interprets as new stock).',
        },
        active: {
          type: 'boolean',
          description: 'Optional override to toggle reward activity.',
        },
      },
    },
    runner: async (args) =>
      supportTools.restockReward({
        rewardId: requireString(args.rewardId, 'rewardId'),
        inventoryDelta: requireNumber(args.inventoryDelta, 'inventoryDelta'),
        active: optionalBoolean(args.active),
      }),
  },
  'support.offerCatalog': {
    name: 'support.offerCatalog',
    description: 'List promotional offers that can be assigned to customers.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        onlyActive: {
          type: 'boolean',
          description: 'When true, exclude inactive or expired offers.',
        },
      },
    },
    runner: async (args) =>
      supportTools.offerCatalog({
        onlyActive: optionalBoolean(args.onlyActive) ?? true,
      }),
  },
  'support.customerOffers': {
    name: 'support.customerOffers',
    description: 'Review offers assigned to an individual customer.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['customerId'],
      properties: {
        customerId: {
          type: 'string',
          description: 'Customer loyalty identifier.',
        },
        includeExpired: {
          type: 'boolean',
          description: 'Include expired or redeemed offers.',
        },
      },
    },
    runner: async (args) =>
      supportTools.customerOffers({
        customerId: requireString(args.customerId, 'customerId'),
        includeExpired: optionalBoolean(args.includeExpired),
      }),
  },
  'support.assignOffer': {
    name: 'support.assignOffer',
    description: 'Assign an offer to a customer for future redemption.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['customerId', 'offerId'],
      properties: {
        customerId: {
          type: 'string',
          description: 'Customer loyalty identifier receiving the offer.',
        },
        offerId: {
          type: 'string',
          description: 'Offer identifier to assign.',
        },
        expiresAt: {
          type: 'string',
          description: 'Optional ISO expiry override.',
          format: 'date-time'
        },
      },
    },
    runner: async (args) =>
      supportTools.assignOffer({
        customerId: requireString(args.customerId, 'customerId'),
        offerId: requireString(args.offerId, 'offerId'),
        expiresAt: optionalString(args.expiresAt),
      }),
  },
  'support.claimOffer': {
    name: 'support.claimOffer',
    description: 'Complete fulfilment of a previously assigned offer.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['customerId', 'customerOfferId'],
      properties: {
        customerId: {
          type: 'string',
          description: 'Customer loyalty identifier.',
        },
        customerOfferId: {
          type: 'string',
          description: 'Identifier of the assigned offer to claim.',
        },
      },
    },
    runner: async (args) =>
      supportTools.claimOffer({
        customerId: requireString(args.customerId, 'customerId'),
        customerOfferId: requireString(args.customerOfferId, 'customerOfferId'),
      }),
  },
};

const TOOL_REGISTRY: Record<ToolName, ToolRunner> = Object.fromEntries(
  Object.entries(TOOL_CONFIG).map(([name, config]) => [name, config.runner]),
) as Record<ToolName, ToolRunner>;

export const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = Object.fromEntries(
  Object.entries(TOOL_CONFIG).map(([name, config]) => [name as ToolName, {
    name: config.name,
    description: config.description,
    inputSchema: config.inputSchema,
  }]),
) as Record<ToolName, ToolDefinition>;

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
