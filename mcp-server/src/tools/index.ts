import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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

export interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}

type ToolConfig<Schema extends z.ZodObject<any>> = {
  name: ToolName;
  description: string;
  schema: Schema;
  runner: (args: z.infer<Schema>) => Promise<unknown>;
};

const snapshotSchema = z
  .object({
    email: z.string().email(),
    includeHistory: z.boolean().optional(),
    historyLimit: z.number().int().min(1).optional(),
  })
  .strict();

const goodwillSchema = z
  .object({
    email: z.string().email(),
    points: z.number().int(),
    reason: z.string().min(1),
    channel: z.string().min(1).optional(),
    historyLimit: z.number().int().min(1).optional(),
  })
  .strict();

const assignSchema = z
  .object({
    email: z.string().email(),
    offerId: z.string().min(1).optional(),
    expiresAt: z.string().min(1).optional(),
  })
  .strict();

const claimSchema = z
  .object({
    email: z.string().email(),
    customerOfferId: z.string().min(1).optional(),
  })
  .strict();

const redeemSchema = z
  .object({
    email: z.string().email(),
    rewardId: z.string().min(1).optional(),
    maxCost: z.number().optional(),
    channel: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
  })
  .strict();

const restockSchema = z
  .object({
    rewardId: z.string().min(1).optional(),
    searchTerm: z.string().min(1).optional(),
    quantity: z.number().optional(),
    targetInventory: z.number().optional(),
    active: z.boolean().optional(),
  })
  .strict();

type AnyToolConfig = ToolConfig<z.ZodObject<any>>;

export const TOOL_CONFIG: Record<ToolName, AnyToolConfig> = {
  'customer.snapshot': {
    name: 'customer.snapshot',
    description:
      'Return a customer profile, recent history, and activity summary. Example: {"email":"marcus.lee@example.com","includeHistory":true,"historyLimit":5}.',
    schema: snapshotSchema,
    runner: async (args) =>
      supportTools.snapshotCustomerFlow({
        email: args.email,
        includeHistory: args.includeHistory,
        historyLimit: args.historyLimit,
      }),
  },
  'loyalty.issueGoodwill': {
    name: 'loyalty.issueGoodwill',
    description:
      'Apply goodwill points to a customer and return the updated balance, activity record, and summary. Example: {"email":"marcus.lee@example.com","points":500,"reason":"Delayed shipment credit"}.',
    schema: goodwillSchema,
    runner: async (args) =>
      supportTools.issueGoodwillFlow({
        email: args.email,
        points: args.points,
        reason: args.reason,
        channel: args.channel,
        historyLimit: args.historyLimit,
      }),
  },
  'offers.assign': {
    name: 'offers.assign',
    description:
      'Assign an offer to a customer and return the updated offer list. Example: {"email":"marcus.lee@example.com","offerId":"offer-espresso-upgrade"}.',
    schema: assignSchema,
    runner: async (args) =>
      supportTools.assignOfferFlow({
        email: args.email,
        offerId: args.offerId,
        expiresAt: args.expiresAt,
      }),
  },
  'offers.claim': {
    name: 'offers.claim',
    description:
      'Claim an assigned offer for a customer and confirm the outcome. Example: {"email":"alicia.patel@example.com","customerOfferId":"offer-alicia-upgrade"}.',
    schema: claimSchema,
    runner: async (args) =>
      supportTools.claimOfferFlow({
        email: args.email,
        customerOfferId: args.customerOfferId,
      }),
  },
  'rewards.redeem': {
    name: 'rewards.redeem',
    description:
      'Redeem a reward on behalf of a customer and return the resulting activity. Example: {"email":"jasmine.ortiz@example.com","rewardId":"reward-espresso"}.',
    schema: redeemSchema,
    runner: async (args) =>
      supportTools.redeemRewardFlow({
        email: args.email,
        rewardId: args.rewardId,
        maxCost: args.maxCost,
        channel: args.channel,
        note: args.note,
      }),
  },
  'rewards.restock': {
    name: 'rewards.restock',
    description:
      'Restock a catalog reward and return the updated record. Example: {"searchTerm":"priority boarding","quantity":5}.',
    schema: restockSchema,
    runner: async (args) =>
      supportTools.restockRewardFlow({
        rewardId: args.rewardId,
        searchTerm: args.searchTerm,
        quantity: args.quantity,
        targetInventory: args.targetInventory,
        active: args.active,
      }),
  },
};

const TOOL_REGISTRY: Record<ToolName, ToolRunner> = Object.fromEntries(
  Object.entries(TOOL_CONFIG).map(([name, config]) => [
    name,
    async (rawArgs: ToolArguments) => {
      const parsed = config.schema.parse(rawArgs);
      return config.runner(parsed);
    },
  ]),
) as Record<ToolName, ToolRunner>;

export const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = Object.fromEntries(
  Object.entries(TOOL_CONFIG).map(([name, config]) => {
    const jsonSchema = zodToJsonSchema(config.schema, { name, $refStrategy: 'none' });
    const { $schema: _omit, ...schemaWithoutMeta } = jsonSchema as Record<string, unknown>;
    return [
      name as ToolName,
      {
        name: config.name,
        description: config.description,
        inputSchema: schemaWithoutMeta,
      },
    ];
  }),
) as Record<ToolName, ToolDefinition>;

export function resolveTool(name: ToolName): ToolRunner {
  const runner = TOOL_REGISTRY[name];
  if (!runner) {
    throw new Error(`Unsupported tool: ${name}`);
  }
  return runner;
}
