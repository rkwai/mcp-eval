import { getSupportAdapter } from '../client/support-adapter';
import { recordOptimizationCapture } from './capture';

export type SupportProgramName =
  | 'snapshot'
  | 'issueGoodwill'
  | 'assignOffer'
  | 'claimOffer'
  | 'redeemReward'
  | 'restockReward';

export interface AxOptimizationConfig {
  enabled: boolean;
  optimizer: 'gepa' | 'gepa-flow';
  autoLevel?: 'light' | 'medium' | 'heavy';
  teacherInstructions?: string;
}

export interface AxEvaluationCapture {
  progress: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  paretoFront?: Array<Record<string, unknown>>;
  scoreHistory?: number[];
  configurationHistory?: Array<Record<string, unknown>>;
}

const PROGRAM_SIGNATURES: Record<SupportProgramName, string> = {
  snapshot: `email:string, includeHistory?:boolean, historyLimit?:number -> customer:json, history:json, summary:json`,
  issueGoodwill: `email:string, points:number, reason:string, channel?:string -> customer:json, activity:json, summary:json`,
  assignOffer: `email:string, offerId?:string, expiresAt?:string -> customer:json, customerOffer:json, offers:json`,
  claimOffer: `email:string, customerOfferId?:string -> customer:json, claim:json, offers:json`,
  redeemReward: `email:string, rewardId?:string, maxCost?:number, channel?:string, note?:string -> customer:json, reward:json, activity:json`,
  restockReward: `rewardId?:string, searchTerm?:string, quantity?:number, targetInventory?:number, active?:boolean -> reward:json`,
};

let runtimePromise: Promise<any> | undefined;
const programCache: Partial<Record<SupportProgramName, any>> = {};

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

  const apiKey = process.env.AX_API_KEY ?? process.env.LLM_PROVIDER_API_KEY;
  if (!apiKey) {
    return { output: {}, capture: undefined };
  }

  const provider = (process.env.AX_PROVIDER ?? 'openrouter') as string;
  const baseURL = process.env.AX_BASE_URL ?? process.env.LLM_PROVIDER_BASE_URL;

  const studentAI = runtime.ai({
    name: provider,
    apiKey,
    baseURL,
  });

  let capture: AxEvaluationCapture | undefined;

  if (optimization?.enabled) {
    capture = {
      progress: [],
      metadata: {
        optimizer: optimization.optimizer,
        autoLevel: optimization.autoLevel,
      },
    };

    try {
      const teacherInstructions = optimization.teacherInstructions ?? defaultTeacherInstructions(name);
      const teacherAI = runtime.ai({
        name: provider,
        apiKey,
        baseURL,
        instructions: teacherInstructions,
      } as Record<string, unknown>);

      const optimizer = optimization.optimizer === 'gepa-flow'
        ? new runtime.AxGEPAFlow({ studentAI, teacherAI })
        : new runtime.AxGEPA({ studentAI, teacherAI });

      if (optimization.autoLevel) {
        optimizer.configureAuto(optimization.autoLevel);
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
      const customers = await adapter.listCustomers();
      return [
        {
          input,
          output: {
            customer: customers.customers[0],
            history: [],
            summary: {},
          },
        },
      ];
    }
    case 'issueGoodwill': {
      const customer = await adapter.getCustomer('cust-marcus');
      return [
        {
          input,
          output: {
            customer,
            activity: {
              type: 'earn',
              points: input.points ?? 0,
            },
            summary: {
              totalEvents: 1,
            },
          },
        },
      ];
    }
    default:
      return [
        {
          input,
          output: {
            result: 'ok',
          },
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

function defaultTeacherInstructions(name: SupportProgramName) {
  switch (name) {
    case 'snapshot':
      return 'Provide detailed feedback on customer snapshot completeness.';
    case 'issueGoodwill':
      return 'Ensure goodwill reasons are explicit and summaries are updated.';
    case 'assignOffer':
      return 'Encourage clarity on offer assignment and expiration communication.';
    case 'claimOffer':
      return 'Emphasize correct claim confirmation and offer state transitions.';
    case 'redeemReward':
      return 'Highlight balance changes and reward details after redemption.';
    case 'restockReward':
      return 'Guide restock reasoning toward low inventory rewards.';
    default:
      return 'Help the student produce clearer, more accurate tool outputs.';
  }
}

