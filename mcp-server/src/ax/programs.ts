import { getSupportAdapter } from '../client/support-adapter';
import { recordOptimizationCapture } from './capture';
import { PROMPTS } from './prompts';
import type { AxEvaluationCapture, AxOptimizationConfig, SupportProgramName } from './types';

const PROGRAM_SIGNATURES: Record<SupportProgramName, string> = {
  snapshot: 'email:string, includeHistory?:boolean, historyLimit?:number -> payload:json',
  issueGoodwill: 'email:string, points:number, reason:string, channel?:string -> payload:json',
  assignOffer: 'email:string, offerId?:string, expiresAt?:string -> payload:json',
  claimOffer: 'email:string, customerOfferId?:string -> payload:json',
  redeemReward: 'email:string, rewardId?:string, maxCost?:number, channel?:string, note?:string -> payload:json',
  restockReward: 'rewardId?:string, searchTerm?:string, quantity?:number, targetInventory?:number, active?:boolean -> payload:json',
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
  const provider = (process.env.LLM_PROVIDER ?? 'openrouter').trim();
  const model = process.env.LLM_MODEL!;
  const baseURL = process.env.LLM_PROVIDER_BASE_URL!;
  const apiKey = process.env.LLM_PROVIDER_API_KEY || 'ollama';
  const temperature = parseNumber(process.env.LLM_TEMPERATURE, 0.1);

  const teacherModel = process.env.AX_TEACHER_MODEL ?? model;
  const teacherTemperature = parseNumber(process.env.AX_TEACHER_TEMPERATURE, 0.3);

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
      temperature,
    },
  };

  const studentAI = runtime.ai(studentConfig);

  let capture: AxEvaluationCapture | undefined;

  const shouldRunOptimization = Boolean(optimization?.enabled);

  const evaluationSamples: Record<string, unknown>[] = [];

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
        teacherModel,
        provider,
        studentConfig: {
          provider,
          model,
          temperature,
        },
        teacherConfig: {
          provider,
          model: teacherModel,
          temperature: teacherTemperature,
        },
      },
    };

    try {
      // Configure teacher AI (same as student)
      const teacherConfig: Record<string, unknown> = {
        name: provider,
        apiKey,
        url: baseURL,
        model: teacherModel,
        config: {
          model: teacherModel,
          temperature: teacherTemperature,
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
      const result = await optimizer.compilePareto(program, examples, buildMetric((prediction) => {
        if (evaluationSamples.length < 5) {
          evaluationSamples.push(JSON.parse(JSON.stringify(prediction)));
        }
      }), {
        callbacks: {
          onProgress: (progress: Record<string, unknown>) => capture?.progress.push({ ...progress }),
        },
      });
      capture.paretoFront = result.paretoFront.map((entry: Record<string, unknown>, index: number) => ({ index, ...entry }));
      capture.scoreHistory = result.scoreHistory;
      capture.configurationHistory = result.configurationHistory?.map((entry: Record<string, unknown>) => ({ ...entry })) ?? undefined;
      capture.metadata.bestScore = result.bestScore;
      if (evaluationSamples.length) {
        capture.samples = evaluationSamples;
      }
    } catch (error) {
      const serializedError = serializeError(error);
      const errorPayload = {
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
        details: serializedError,
      };
      capture.metadata.optimizerError = errorPayload;
      capture.metadata.error = (error as Error).message;
      capture.metadata.errorDetails = serializedError;
      if (isPermissionDenied(serializedError)) {
        capture.metadata.hint = 'GEPA could not reach the configured LLM (permission denied). Allow network access or disable AX optimizers.';
      }
    }
  }

  let output: Record<string, unknown> = {};
  try {
    output = (await program.forward(studentAI, input)) as Record<string, unknown>;
    if (capture) {
      capture.metadata.programOutput = output;
    }
  } catch (error) {
    if (capture) {
      capture.metadata.forwardError = (error as Error).message;
    }
  }

  if (capture) {
    const suggestions = collectSuggestions(name, capture.samples ?? evaluationSamples, input, output);
    if (suggestions.length) {
      capture.metadata.suggestions = suggestions;
    }
    recordOptimizationCapture(name, capture);
  }

  return { output, capture };
}

function serializeError(error: unknown, depth = 0): Record<string, unknown> | string | undefined {
  if (!error) {
    return undefined;
  }
  if (typeof error !== 'object') {
    return typeof error === 'string' ? error : JSON.stringify(error);
  }
  const result: Record<string, unknown> = {};
  const knownKeys: Array<keyof Error> = ['name', 'message', 'stack'];
  for (const key of knownKeys) {
    const value = (error as Record<string, unknown>)[key as string];
    if (value !== undefined) {
      result[key as string] = value;
    }
  }
  if ('code' in (error as Record<string, unknown>)) {
    result.code = (error as Record<string, unknown>).code;
  }
  if ('cause' in (error as Record<string, unknown>) && depth < 4) {
    result.cause = serializeError((error as Record<string, unknown>).cause, depth + 1);
  }
  const response = (error as Record<string, unknown>).response as {
    status?: number;
    statusText?: string;
    data?: unknown;
  } | undefined;
  if (response) {
    result.response = {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
    };
  }
  const details = (error as Record<string, unknown>).details;
  if (details) {
    result.details = details;
  }
  return result;
}

function isPermissionDenied(details: unknown, depth = 0): boolean {
  if (!details || depth > 4) {
    return false;
  }
  if (typeof details === 'string') {
    return details.includes('EPERM');
  }
  const record = details as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : undefined;
  const syscall = typeof record.syscall === 'string' ? record.syscall : undefined;
  if (code === 'EPERM' || (syscall === 'connect' && record.address && record.port)) {
    return true;
  }
  const nested = (record as { cause?: unknown }).cause;
  if (nested !== undefined) {
    return isPermissionDenied(nested, depth + 1);
  }
  return false;
}

async function buildExamples(name: SupportProgramName, input: Record<string, unknown>) {
  const adapter = getSupportAdapter();

  switch (name) {
    case 'snapshot': {
      const customer = await ensureCustomerProfile(adapter, input.email);
      const includeHistory = coerceBoolean(input.includeHistory, true);
      const historyLimit = coercePositiveInteger(input.historyLimit, 5);
      return [
        {
          email: customer.email,
          includeHistory,
          historyLimit,
          payload: {
            email: customer.email,
            includeHistory,
            historyLimit,
          },
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
          payload: {
            email: customer.email,
            points,
            reason,
            channel,
          },
        },
      ];
    }
    case 'assignOffer': {
      const customer = await ensureCustomerProfile(adapter, input.email);
      const offer = await ensureOffer(adapter, input.offerId);
      const expiresAt = coerceString(input.expiresAt, isoDaysAhead(7));
      return [
        {
          email: customer.email,
          offerId: offer.id,
          expiresAt,
          payload: {
            email: customer.email,
            offerId: offer.id,
            expiresAt,
          },
        },
      ];
    }
    case 'claimOffer': {
      const customer = await ensureCustomerProfile(adapter, input.email);
      const customerOffers = await ensureCustomerOffers(adapter, customer.id);
      const availableOffer = customerOffers.find((entry: { status: string }) => entry.status === 'available') ?? customerOffers[0];
      const offerEntry = availableOffer ?? createSampleCustomerOffer(customer.id, await ensureOffer(adapter));
      return [
        {
          email: customer.email,
          customerOfferId: offerEntry.id,
          payload: {
            email: customer.email,
            customerOfferId: offerEntry.id,
          },
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
          payload: {
            email: customer.email,
            rewardId: reward.id,
            maxCost: input.maxCost,
            channel,
            note,
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
          payload: {
            rewardId: reward.id,
            targetInventory,
            quantity: typeof quantity === 'number' ? quantity : undefined,
            active,
            searchTerm: input.searchTerm ? coerceString(input.searchTerm, reward.name) : undefined,
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

function buildMetric(logSample?: (prediction: Record<string, unknown>) => void) {
  return ({ prediction }: { prediction: Record<string, unknown> }) => {
    if (!prediction) return 0;
    if (logSample) {
      logSample(prediction);
    }
    const fieldCount = Object.keys(prediction).length;
    return fieldCount > 0 ? 1 : 0.1;
  };
}

function collectSuggestions(
  name: SupportProgramName,
  samples: Array<Record<string, unknown>>,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
): string[] {
  if (!samples || samples.length === 0) {
    return [];
  }
  const payloads = samples
    .map((sample) => extractPayload(sample))
    .filter((payload): payload is Record<string, unknown> => Boolean(payload));

  const suggestions: string[] = [];

  if (name === 'redeemReward') {
    const requiresMaxCost = typeof input.maxCost === 'number';
    const hasCamelRewardId = payloads.some((payload) => typeof payload['rewardId'] === 'string');
    const hasSnakeRewardId = payloads.some((payload) => typeof payload['reward_id'] === 'string');
    const hasAnyRewardId = hasCamelRewardId || hasSnakeRewardId;
    if (!hasAnyRewardId) {
      suggestions.push('Prompt the model to include payload.rewardId so the failing redemption has a concrete target reward.');
    } else if (!hasCamelRewardId && hasSnakeRewardId) {
      suggestions.push('Remind the model to emit rewardId in camelCase (rewardId) instead of reward_id.');
    }

    const hasCamelMaxCost = payloads.some((payload) => Object.prototype.hasOwnProperty.call(payload, 'maxCost'));
    const hasSnakeMaxCost = payloads.some((payload) => Object.prototype.hasOwnProperty.call(payload, 'max_cost'));
    if (requiresMaxCost && !hasCamelMaxCost) {
      if (hasSnakeMaxCost) {
        suggestions.push('Explicitly state that maxCost must stay camelCase when relaying user caps.');
      } else {
        suggestions.push('Tell the model to echo payload.maxCost when customers specify a points ceiling.');
      }
    }

    const anySnakeCase = payloads.some((payload) =>
      Object.keys(payload).some((key) => key.includes('_')),
    );
    if (anySnakeCase) {
      suggestions.push('Clarify in the prompt that payload keys must use camelCase (rewardId, maxCost, channel, etc.).');
    }

    const missingChannel = payloads.every((payload) => payload['channel'] === undefined);
    if (missingChannel && input.channel) {
      suggestions.push('Ask the model to pass through the requested channel so support can audit where redemptions happen.');
    }
  }

  if (suggestions.length === 0 && !output.payload) {
    suggestions.push('Encourage the model to return a payload object so GEPA can compare candidates meaningfully.');
  }

  return suggestions;
}

function extractPayload(sample: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!sample) {
    return undefined;
  }
  const candidate = (sample as Record<string, unknown>)['payload'];
  if (candidate && typeof candidate === 'object') {
    return candidate as Record<string, unknown>;
  }
  return sample;
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
