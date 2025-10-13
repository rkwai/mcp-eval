import { getSupportAdapter } from '../client/support-adapter';
import { recordOptimizationCapture } from './capture';
import { PROMPTS } from './prompts';
import type { AxEvaluationCapture, AxOptimizationConfig, SupportProgramName } from './types';

const PROGRAM_SIGNATURES: Record<SupportProgramName, string> = {
  snapshot: 'email:string, includeHistory?:boolean, historyLimit?:number -> customer:json, history:json, summary:json',
  issueGoodwill: 'email:string, points:number, reason:string, channel?:string -> customer:json, activity:json, summary:json',
  assignOffer: 'email:string, offerId?:string, expiresAt?:string -> customer:json, customerOffer:json, offers:json',
  claimOffer: 'email:string, customerOfferId?:string -> customer:json, claim:json, offers:json',
  redeemReward: 'email:string, rewardId?:string, maxCost?:number, channel?:string, note?:string -> customer:json, reward:json, activity:json',
  restockReward: 'rewardId?:string, searchTerm?:string, quantity?:number, targetInventory?:number, active?:boolean -> reward:json',
};

const DEFAULT_MODEL = 'hf.co/bartowski/Qwen2.5-7B-Instruct-GGUF:Q4_K_M';

let runtimePromise: Promise<any> | undefined;
const programCache: Partial<Record<SupportProgramName, any>> = {};

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadRuntime(): Promise<any> {
  if (!runtimePromise) {
    runtimePromise = import('@ax-llm/ax');
  }
  return runtimePromise;
}

export async function ensureProgram(name: SupportProgramName) {
  const cached = programCache[name];
  if (cached) {
    return cached;
  }

  const runtime = await loadRuntime();
  const program = runtime.ax(PROGRAM_SIGNATURES[name]);
  programCache[name] = program;
  return program;
}

export async function runProgram(
  name: SupportProgramName,
  input: Record<string, unknown>,
  optimization?: AxOptimizationConfig,
) {
  const program = await ensureProgram(name);
  const runtime = await loadRuntime();

  // Read configuration directly from environment
  const providerRaw = process.env.LLM_PROVIDER ?? 'openrouter';
  const provider = providerRaw.trim();
  const providerId = provider.toLowerCase();
  const model = process.env.LLM_MODEL!;
  const baseURL = process.env.LLM_PROVIDER_BASE_URL!;
  const apiKey = process.env.LLM_PROVIDER_API_KEY || 'ollama';
  const temperature = parseNumber(process.env.LLM_TEMPERATURE, 0.1);

  // Configure student AI
  // Note: For Ollama, LLM_PROVIDER_BASE_URL should be http://localhost:11434 (without /v1)
  //       Ax will automatically add /v1/chat/completions
  const studentConfig: Record<string, unknown> = {
    name: provider,
    apiKey,
    url: baseURL,
    model,
    config: { 
      model,
      temperature 
    },
  };

  const studentAI = runtime.ai(studentConfig);
  
  // Debug: Log the configuration being used
  if (process.env.AX_DEBUG === 'true') {
    console.log('[DEBUG] Student AI Config:', JSON.stringify(studentConfig, null, 2));
  }

  let capture: AxEvaluationCapture | undefined;

  const shouldRunOptimization = Boolean(optimization?.enabled);

  if (!shouldRunOptimization && optimization?.enabled) {
    capture = {
      progress: [],
      metadata: {
        optimizer: optimization.optimizer,
        autoLevel: optimization.autoLevel,
        skipped: true,
        reason: 'optimization-disabled',
        provider,
      },
    };
  }

  if (shouldRunOptimization && optimization) {
    const optimizerConfig = optimization;
    capture = {
      progress: [],
      metadata: {
        optimizer: optimizerConfig.optimizer,
        autoLevel: optimizerConfig.autoLevel,
        studentModel: model,
        teacherModel: model,
      },
    };

    try {
      // Configure teacher AI (same as student)
      const teacherConfig: Record<string, unknown> = {
        name: provider,
        apiKey,
        url: baseURL,
        model,
        config: {
          model,
          temperature,
        },
      };

      const teacherAI = runtime.ai(teacherConfig);

      const optimizer = optimizerConfig.optimizer === 'gepa-flow'
        ? new runtime.AxGEPAFlow({ studentAI, teacherAI })
        : new runtime.AxGEPA({ studentAI, teacherAI });

      if (optimizerConfig.autoLevel) {
        optimizer.configureAuto(optimizerConfig.autoLevel);
      }

      const examples = await buildExamples(name, input);
      const result = await optimizer.compilePareto(program, examples, buildMetric(), {
        callbacks: {
          onProgress: (progress: Record<string, unknown>) => capture?.progress.push({ ...progress }),
        },
      });

      capture.paretoFront = result.paretoFront.map((entry: Record<string, unknown>, index: number) => ({ index, ...entry }));
      capture.scoreHistory = result.scoreHistory;
      capture.configurationHistory = result.configurationHistory?.map((entry: Record<string, unknown>) => ({ ...entry })) ?? undefined;
      capture.metadata.bestScore = result.bestScore;
    } catch (error) {
      console.error('[GEPA] optimizer error', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        signatureInputs: program.signature?.getInputFields?.().map(
          (field: { name: string; isOptional?: boolean }) => ({
            name: field.name,
            optional: Boolean(field.isOptional),
            required: !field.isOptional,
          }),
        ),
        providedInput: input,
      });
      capture.metadata.error = (error as Error).message;
    }
  }

  let output: Record<string, unknown> = {};
  try {
    output = (await program.forward(studentAI, input)) as Record<string, unknown>;
  } catch (error) {
    if (capture) {
      capture.metadata.forwardError = (error as Error).message;
    }
  }

  if (capture) {
    recordOptimizationCapture(name, capture);
  }

  return { output, capture };
}

async function buildExamples(name: SupportProgramName, input: Record<string, unknown>) {
  const adapter = getSupportAdapter();

  switch (name) {
    case 'snapshot': {
      const customer = await ensureCustomerProfile(adapter, input.email);
      const includeHistory = coerceBoolean(input.includeHistory, true);
      const historyLimit = coercePositiveInteger(input.historyLimit, 5);
      const history = includeHistory
        ? (await safeCustomerHistory(adapter, customer.id)).slice(0, historyLimit)
        : [];
      return [
        {
          email: customer.email,
          includeHistory,
          historyLimit,
          customer,
          history,
          summary: { totalEvents: history.length },
        },
      ];
    }
    case 'issueGoodwill': {
      const customer = await ensureCustomerProfile(adapter, input.email);
      const points = coercePositiveInteger(input.points, 500);
      const reason = coerceString(input.reason, 'Service recovery credit');
      const channel = coerceOptionalString(input.channel);
      return [
        {
          email: customer.email,
          points,
          reason,
          ...(channel ? { channel } : {}),
          customer,
          activity: {
            type: 'earn',
            points,
            balanceAfter: customer.pointsBalance + points,
            source: `Goodwill - ${reason}`,
          },
          summary: { totalEvents: 1 },
        },
      ];
    }
    case 'assignOffer': {
      const customer = await ensureCustomerProfile(adapter, input.email);
      const offersSnapshot = await ensureCustomerOffers(adapter, customer.id);
      const offer = await ensureOffer(adapter, input.offerId);
      const expiresAt = coerceString(input.expiresAt, isoDaysAhead(7));
      const customerOffer = {
        id: generateId('coffer'),
        offerId: offer.id,
        customerId: customer.id,
        status: 'available',
        assignedAt: nowIso(),
        expiresAt,
        offer,
      };
      const offers = [customerOffer, ...offersSnapshot.filter((entry: { id: string }) => entry.id !== customerOffer.id)];
      return [
        {
          email: customer.email,
          offerId: offer.id,
          expiresAt,
          customer,
          customerOffer,
          offers,
        },
      ];
    }
    case 'claimOffer': {
      const customer = await ensureCustomerProfile(adapter, input.email);
      const customerOffers = await ensureCustomerOffers(adapter, customer.id);
      const availableOffer = customerOffers.find((entry: { status: string }) => entry.status === 'available') ?? customerOffers[0];
      const offerEntry = availableOffer ?? createSampleCustomerOffer(customer.id, await ensureOffer(adapter));
      const claimRecord = {
        customer,
        offer: offerEntry.offer ?? (await ensureOffer(adapter)),
        customerOffer: {
          ...offerEntry,
          status: 'claimed',
          claimedAt: nowIso(),
        },
        reward: await ensureReward(adapter, offerEntry.offer?.rewardId),
        activity: {
          id: generateId('act'),
          customerId: customer.id,
          type: 'redeem',
          points: -400,
          balanceAfter: Math.max(0, customer.pointsBalance - 400),
          source: offerEntry.offer?.name ?? 'Claimed offer',
          occurredAt: nowIso(),
        },
      };
      const refreshedOffers = customerOffers.map((entry) => (
        entry.id === offerEntry.id
          ? { ...entry, status: 'claimed', claimedAt: claimRecord.customerOffer.claimedAt }
          : entry
      ));
      return [
        {
          email: customer.email,
          customerOfferId: offerEntry.id,
          customer,
          claim: claimRecord,
          offers: refreshedOffers,
        },
      ];
    }
    case 'redeemReward': {
      const customer = await ensureCustomerProfile(adapter, input.email);
      const reward = await ensureReward(adapter, input.rewardId, input.maxCost, input.channel, input.note);
      const channel = coerceString(input.channel, 'support');
      const note = coerceOptionalString(input.note);
      return [
        {
          email: customer.email,
          rewardId: reward.id,
          channel,
          ...(input.maxCost !== undefined ? { maxCost: coercePositiveInteger(input.maxCost, reward.cost) } : {}),
          ...(note ? { note } : {}),
          customer: {
            ...customer,
            pointsBalance: Math.max(0, customer.pointsBalance - reward.cost),
          },
          reward,
          activity: {
            id: generateId('act'),
            customerId: customer.id,
            type: 'redeem',
            points: -reward.cost,
            balanceAfter: Math.max(0, customer.pointsBalance - reward.cost),
            source: reward.name,
            channel,
            occurredAt: nowIso(),
            metadata: note ? { note } : undefined,
          },
        },
      ];
    }
    case 'restockReward': {
      const reward = await ensureReward(adapter, input.rewardId, undefined, undefined, undefined, input.searchTerm);
      const quantity = coerceNumber(input.quantity, 0);
      const targetInventory = determineTargetInventory(reward.inventory, quantity, input.targetInventory);
      const active = coerceOptionalBoolean(input.active, reward.active);
      return [
        {
          rewardId: reward.id,
          targetInventory,
          ...(typeof quantity === 'number' && quantity !== 0 && input.targetInventory === undefined ? { quantity } : {}),
          ...(typeof active === 'boolean' ? { active } : {}),
          ...(input.searchTerm ? { searchTerm: coerceString(input.searchTerm, reward.name) } : {}),
          reward: {
            ...reward,
            inventory: targetInventory,
            active: typeof active === 'boolean' ? active : reward.active,
          },
        },
      ];
    }
    default:
      return [
        {
          ...input,
        },
      ];
  }
}

function buildMetric() {
  return ({ prediction }: { prediction: Record<string, unknown> }) => {
    if (!prediction) return 0;
    const fieldCount = Object.keys(prediction).length;
    return fieldCount > 0 ? 1 : 0.1;
  };
}

async function ensureCustomerProfile(adapter: ReturnType<typeof getSupportAdapter>, emailValue: unknown) {
  const requestedEmail = coerceOptionalString(emailValue)?.toLowerCase();
  try {
    const list = await adapter.listCustomers();
    const candidates = Array.isArray(list?.customers)
      ? list.customers.map((entry) => {
        if ('phone' in entry) {
          return entry;
        }
        return {
          id: entry.id,
          name: entry.email,
          email: entry.email,
          phone: undefined,
          tier: 'silver',
          pointsBalance: 0,
          lifetimePoints: 0,
          preferences: { marketingOptIn: true, preferredChannel: 'email' },
          joinedAt: nowIso(),
          updatedAt: nowIso(),
          recentActivity: [],
        };
      })
      : [];
    const matched = requestedEmail
      ? candidates.find((entry) => entry.email?.toLowerCase() === requestedEmail)
      : undefined;
    const fallback = matched ?? candidates[0];
    if (fallback?.id) {
      const details = await adapter.getCustomer(fallback.id);
      if (details?.email) {
        return details;
      }
      return {
        ...fallback,
        email: fallback.email ?? requestedEmail ?? 'sample.customer@example.com',
      };
    }
  } catch (_error) {
    // ignore adapter errors; fall back to sample data
  }
  return createSampleCustomer(requestedEmail ?? 'sample.customer@example.com');
}

async function safeCustomerHistory(adapter: ReturnType<typeof getSupportAdapter>, customerId: string) {
  try {
    const historyResponse = await adapter.getCustomerHistory(customerId);
    return Array.isArray(historyResponse?.history) ? historyResponse.history : [];
  } catch (_error) {
    return [];
  }
}

async function ensureOffer(
  adapter: ReturnType<typeof getSupportAdapter>,
  offerIdValue?: unknown,
): Promise<any> {
  const requestedId = coerceOptionalString(offerIdValue)?.toLowerCase();
  try {
    const offersResponse = await adapter.listOffers();
    const offers = Array.isArray(offersResponse?.offers) ? offersResponse.offers : [];
    const match = requestedId
      ? offers.find((entry) => entry.id?.toLowerCase() === requestedId)
      : undefined;
    return match ?? offers[0] ?? createSampleOffer();
  } catch (_error) {
    return createSampleOffer();
  }
}

async function ensureCustomerOffers(adapter: ReturnType<typeof getSupportAdapter>, customerId: string): Promise<any[]> {
  try {
    const response = await adapter.listCustomerOffers(customerId);
    const offers = Array.isArray(response?.offers) ? response.offers : [];
    return offers.length ? offers : [createSampleCustomerOffer(customerId, await ensureOffer(adapter))];
  } catch (_error) {
    return [createSampleCustomerOffer(customerId, await ensureOffer(adapter))];
  }
}

async function ensureReward(
  adapter: ReturnType<typeof getSupportAdapter>,
  rewardIdValue?: unknown,
  maxCostValue?: unknown,
  _channel?: unknown,
  _note?: unknown,
  searchTerm?: unknown,
): Promise<any> {
  const requestedId = coerceOptionalString(rewardIdValue)?.toLowerCase();
  const normalizedSearch = coerceOptionalString(searchTerm)?.toLowerCase();
  const maxCost = coercePositiveInteger(maxCostValue, undefined);
  try {
    const catalog = await adapter.listRewards();
    const rewards = Array.isArray(catalog?.rewards) ? catalog.rewards : [];
    const byId = requestedId
      ? rewards.find((entry) => entry.id?.toLowerCase() === requestedId)
      : undefined;
    const bySearch = !byId && normalizedSearch
      ? rewards.find((entry) => entry.id?.toLowerCase().includes(normalizedSearch) || entry.name?.toLowerCase().includes(normalizedSearch))
      : undefined;
    const byCost = !byId && !bySearch && typeof maxCost === 'number'
      ? rewards.find((entry) => typeof entry.cost === 'number' && entry.cost <= maxCost)
      : undefined;
    return byId ?? bySearch ?? byCost ?? rewards[0] ?? createSampleReward();
  } catch (_error) {
    return createSampleReward();
  }
}

function determineTargetInventory(
  currentInventory: unknown,
  quantityValue: unknown,
  explicitTarget: unknown,
) {
  if (typeof explicitTarget === 'number' && Number.isFinite(explicitTarget)) {
    return Math.max(0, Math.round(explicitTarget));
  }
  const delta = coerceNumber(quantityValue, 0) ?? 0;
  const current = typeof currentInventory === 'number' ? currentInventory : 0;
  return Math.max(0, Math.round(current + delta));
}

function coerceString<T extends string | undefined>(value: unknown, fallback: T extends string ? string : string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback as string;
}

function coerceOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function coerceOptionalBoolean(value: unknown, fallback: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  return undefined;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function coercePositiveInteger(value: unknown, fallback: number | undefined): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed);
  }
  if (fallback !== undefined) {
    return fallback;
  }
  return 1;
}

function coerceNumber(value: unknown, fallback: number | undefined): number | undefined {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function createSampleCustomer(email: string) {
  const now = nowIso();
  return {
    id: 'cust-sample',
    name: 'Sample Customer',
    email,
    phone: '555-0000',
    tier: 'silver',
    pointsBalance: 5000,
    lifetimePoints: 5000,
    preferences: { marketingOptIn: true, preferredChannel: 'email' },
    joinedAt: now,
    updatedAt: now,
    recentActivity: [],
  };
}

function createSampleOffer() {
  const now = nowIso();
  return {
    id: 'offer-sample',
    name: 'Sample Offer',
    description: 'Sample offer for optimisation demonstrations.',
    rewardId: 'reward-sample',
    startDate: now,
    endDate: isoDaysAhead(7),
    active: true,
    quantity: null,
  };
}

function createSampleCustomerOffer(customerId: string, offer: any) {
  return {
    id: generateId('coffer'),
    offerId: offer.id,
    customerId,
    status: 'available',
    assignedAt: nowIso(),
    expiresAt: offer.endDate ?? isoDaysAhead(7),
    offer,
  };
}

function createSampleReward() {
  return {
    id: 'reward-sample',
    name: 'Sample Reward',
    description: 'Placeholder reward for optimisation demonstrations.',
    cost: 750,
    inventory: 25,
    active: true,
    fulfillmentInstructions: 'Show this confirmation at checkout.',
  };
}

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function isoDaysAhead(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
