import * as supportTools from './support';

export type ToolName =
  | 'customer.snapshot'
  | 'loyalty.issueGoodwill'
  | 'offers.assign'
  | 'offers.claim'
  | 'rewards.redeem'
  | 'rewards.restock';

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
  'customer.snapshot': {
    name: 'customer.snapshot',
    description:
      'Return a customer profile, recent history, and activity summary. Example: {"email":"marcus.lee@example.com","includeHistory":true,"historyLimit":5}.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['email'],
      properties: {
        email: {
          type: 'string',
          description: 'Customer email to snapshot.',
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
      supportTools.snapshotCustomerFlow({
        email: requireString(args.email, 'email'),
        includeHistory: optionalBoolean(args.includeHistory),
        historyLimit: optionalNumber(args.historyLimit),
      }),
  },
  'loyalty.issueGoodwill': {
    name: 'loyalty.issueGoodwill',
    description:
      'Apply goodwill points to a customer and return the updated balance, activity record, and summary. Example: {"email":"marcus.lee@example.com","points":500,"reason":"Delayed shipment credit"}.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['email', 'points', 'reason'],
      properties: {
        email: {
          type: 'string',
          description: 'Customer email to credit.',
          format: 'email'
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
        historyLimit: {
          type: 'number',
          description: 'Activity records to include in the summary.',
        },
      },
    },
    runner: async (args) =>
      supportTools.issueGoodwillFlow({
        email: requireString(args.email, 'email'),
        points: requireNumber(args.points, 'points'),
        reason: requireString(args.reason, 'reason'),
        channel: optionalString(args.channel),
        historyLimit: optionalNumber(args.historyLimit),
      }),
  },
  'offers.assign': {
    name: 'offers.assign',
    description:
      'Assign an offer to a customer and return the updated offer list. Example: {"email":"marcus.lee@example.com","offerId":"offer-espresso-upgrade"}.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['email'],
      properties: {
        email: {
          type: 'string',
          description: 'Customer email to receive the offer.',
          format: 'email'
        },
        offerId: {
          type: 'string',
          description: 'Specific offer to assign (defaults to first active offer).',
        },
        expiresAt: {
          type: 'string',
          description: 'Optional ISO expiry override.',
          format: 'date-time'
        },
      },
    },
    runner: async (args) =>
      supportTools.assignOfferFlow({
        email: requireString(args.email, 'email'),
        offerId: optionalString(args.offerId),
        expiresAt: optionalString(args.expiresAt),
      }),
  },
  'offers.claim': {
    name: 'offers.claim',
    description:
      'Claim an assigned offer for a customer and confirm the outcome. Example: {"email":"alicia.patel@example.com","customerOfferId":"coffer-alicia-upgrade"}.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['email'],
      properties: {
        email: {
          type: 'string',
          description: 'Customer email whose offer should be claimed.',
          format: 'email'
        },
        customerOfferId: {
          type: 'string',
          description: 'Specific customer offer to claim (defaults to first available).',
        },
      },
    },
    runner: async (args) =>
      supportTools.claimOfferFlow({
        email: requireString(args.email, 'email'),
        customerOfferId: optionalString(args.customerOfferId),
      }),
  },
  'rewards.redeem': {
    name: 'rewards.redeem',
    description:
      'Redeem a reward on behalf of a customer and return the resulting activity. Example: {"email":"jasmine.ortiz@example.com","rewardId":"reward-espresso"}.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['email'],
      properties: {
        email: {
          type: 'string',
          description: 'Customer email.',
          format: 'email'
        },
        rewardId: {
          type: 'string',
          description: 'Specific reward to redeem (defaults to first matching reward).',
        },
        maxCost: {
          type: 'number',
          description: 'Filter rewards to those at or below this cost when rewardId is omitted.',
        },
        channel: {
          type: 'string',
          description: 'Channel recorded for the redemption.',
        },
        note: {
          type: 'string',
          description: 'Optional note stored with the redemption.',
        },
      },
    },
    runner: async (args) =>
      supportTools.redeemRewardFlow({
        email: requireString(args.email, 'email'),
        rewardId: optionalString(args.rewardId),
        maxCost: optionalNumber(args.maxCost),
        channel: optionalString(args.channel),
        note: optionalString(args.note),
      }),
  },
  'rewards.restock': {
    name: 'rewards.restock',
    description:
      'Restock a catalog reward and return the updated record. Example: {"searchTerm":"priority boarding","quantity":5}.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rewardId: {
          type: 'string',
          description: 'Specific reward to restock (defaults to lowest inventory reward).',
        },
        searchTerm: {
          type: 'string',
          description: 'Optional fuzzy match against reward id or name when rewardId is omitted.',
        },
        quantity: {
          type: 'number',
          description: 'Units to add to the current inventory.',
        },
        targetInventory: {
          type: 'number',
          description: 'Set inventory to this exact value (overrides quantity).',
        },
        active: {
          type: 'boolean',
          description: 'Optional override to toggle the reward active state.',
        },
      },
    },
    runner: async (args) =>
      supportTools.restockRewardFlow({
        rewardId: optionalString(args.rewardId),
        searchTerm: optionalString(args.searchTerm),
        quantity: optionalNumber(args.quantity),
        targetInventory: optionalNumber(args.targetInventory),
        active: optionalBoolean(args.active),
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
