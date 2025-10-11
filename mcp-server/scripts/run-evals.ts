#!/usr/bin/env ts-node
/// <reference path="../src/types/yargs.d.ts" />
/// <reference types="node" />
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runTool, ToolCall } from '../src';
import { ToolName, ToolArguments } from '../src/tools';
import { runLlmSession, TranscriptMessage } from '../src/runtime/llm-session';
import { loadEnv } from '../src/config/load-env';
import { writeEvalLog } from '../src/evals/log_writer';
import { drainOptimizationCaptures } from '../src/ax/capture';
import { createFetchTransport } from '../src/client/transport';
import { useTransport } from '../src/client/support-adapter';
import { createMockTransport } from '../src/client/mock-transport';

loadEnv();
const loggingEnabled = String(process.env.EVAL_LOGS_ENABLED ?? '').toLowerCase() === 'true';

type Assertion = {
  path: string;
  equals?: unknown;
  contains?: string;
  minLength?: number;
  exists?: boolean;
  isNull?: boolean;
};

type Step = {
  label: string;
  tool: ToolName;
  arguments: Record<string, unknown>;
  capture?: Record<string, string>;
  expect?: {
    status?: 'success' | 'error';
    assert?: Assertion[];
  };
};

type Scenario = {
  id: string;
  description: string;
  steps: Step[];
  conversation?: ConversationMessage[];
};

type EvalResult = {
  scenario: string;
  passed: boolean;
  failures: string[];
};

type ToolCallLog = {
  label: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'success' | 'error';
  error?: string;
};

type ScenarioExecution = {
  result: EvalResult;
  toolCalls: ToolCallLog[];
  transcript?: TranscriptMessage[];
};

type ConversationMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  variant?: string;
};

const scenarioDir = path.join(__dirname, '..', 'evals', 'scenarios');

type EnvironmentHooks = {
  beforeScenario(): Promise<void>;
  beforeVariant(): Promise<void>;
};

function createRunId() {
  return `${Date.now().toString(36)}-${randomUUID()}`;
}

function configureEnvironment(liveMode: boolean): EnvironmentHooks {
  if (!liveMode) {
    return {
      beforeScenario: async () => {
        useTransport(createMockTransport());
      },
      beforeVariant: async () => {
        useTransport(createMockTransport());
      },
    };
  }

  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    console.error('API_BASE_URL is required when running evals with --live.');
    process.exit(1);
  }

  const defaultHeaders = buildDefaultHeaders();
  const timeoutMs = parsePositiveInt('API_TIMEOUT_MS', process.env.API_TIMEOUT_MS, 15000);
  const transport = createFetchTransport({ baseUrl, defaultHeaders, timeoutMs });
  useTransport(transport);

  return {
    beforeScenario: async () => {},
    beforeVariant: async () => {},
  };
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('scenario', {
      type: 'string',
      describe: 'Run a single scenario (by id). Runs all when omitted.',
    })
    .option('verbose', {
      type: 'boolean',
      default: false,
    })
    .option('live', {
      type: 'boolean',
      default: false,
      describe: 'Route tool calls through the live HTTP adapter (implies --llm).',
    })
    .option('llm', {
      type: 'boolean',
      default: false,
      describe: 'Run scenarios with an LLM choosing tools (defaults to deterministic tool harness).',
    })
    .parse();

  const liveMode = Boolean(argv.live);
  const envHooks = configureEnvironment(liveMode);

  const useLlm = liveMode || Boolean(argv.llm);
  if (liveMode) {
    console.log(
      '⚙️  Running live end-to-end evals (LLM + live adapter). Ensure API_BASE_URL and LLM_* env vars are configured.',
    );
  } else if (useLlm) {
    console.log(
      '⚙️  Running evals with LLM tool selection (provider: openrouter). Ensure LLM_MODEL, LLM_PROVIDER_API_KEY, and LLM_PROVIDER_BASE_URL are set.',
    );
  } else {
    console.log('⚙️  Running deterministic tool evals.');
  }

  const scenarios = loadScenarios(argv.scenario);
  if (scenarios.length === 0) {
    console.error('No scenarios matched your selection.');
    process.exit(1);
  }

  const executions: ScenarioExecution[] = [];
  for (const scenario of scenarios) {
    if (useLlm) {
      const variantExecutions = await runScenarioLlm(scenario, envHooks, argv.verbose ?? false);
      executions.push(...variantExecutions);

      if (loggingEnabled) {
        const optimizationRuns = drainOptimizationCaptures().map((entry) => ({
          program: entry.program,
          timestamp: entry.timestamp,
          capture: entry.capture,
        }));
        for (const execution of variantExecutions) {
          writeEvalLog({
            timestamp: new Date().toISOString(),
            runId: createRunId(),
            scenario: execution.result.scenario,
            mode: 'llm',
            status: execution.result.passed ? 'passed' : 'failed',
            failures: execution.result.failures,
            toolCalls: execution.toolCalls,
            transcript: execution.transcript?.map((entry) => ({ role: entry.role, content: entry.content })),
            optimization: optimizationRuns.length ? optimizationRuns : undefined,
          });
        }
      }
    } else {
      const execution = await runScenarioTools(scenario, envHooks, argv.verbose ?? false);
      executions.push(execution);

      if (loggingEnabled) {
        const optimization = drainOptimizationCaptures().map((entry) => ({
          program: entry.program,
          timestamp: entry.timestamp,
          capture: entry.capture,
        }));
        writeEvalLog({
          timestamp: new Date().toISOString(),
          runId: createRunId(),
          scenario: execution.result.scenario,
          mode: 'tools',
          status: execution.result.passed ? 'passed' : 'failed',
          failures: execution.result.failures,
          toolCalls: execution.toolCalls,
          transcript: execution.transcript?.map((entry) => ({ role: entry.role, content: entry.content })),
          optimization: optimization.length ? optimization : undefined,
        });
      }
    }
  }

  const passed = executions.filter((execution) => execution.result.passed).length;
  const failed = executions.length - passed;

  console.log('\n=== Eval Summary ===');
  console.log(`Scenarios run: ${executions.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    for (const execution of executions.filter((ex) => !ex.result.passed)) {
      console.log(`\n❌ ${execution.result.scenario}`);
      execution.result.failures.forEach((failure) => console.log(`  - ${failure}`));
    }
    process.exit(1);
  }
}

function loadScenarios(filter?: string): Scenario[] {
  const files = fs.readdirSync(scenarioDir).filter((file) => file.endsWith('.json'));
  const scenarios: Scenario[] = [];

  for (const file of files) {
    const fullPath = path.join(scenarioDir, file);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const scenario = JSON.parse(raw) as Scenario;
    if (!filter || scenario.id === filter) {
      scenarios.push(scenario);
    }
  }

  return scenarios;
}

function cloneArgs(input: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!input) {
    return {};
  }
  try {
    return JSON.parse(JSON.stringify(input));
  } catch (_error) {
    return { ...input };
  }
}

function cloneMessage(message: ConversationMessage): ConversationMessage {
  return {
    role: message.role,
    content: message.content,
  };
}

function expandConversationVariants(messages: ConversationMessage[]): ConversationMessage[][] {
  if (!messages || messages.length === 0) {
    return [];
  }

  const hasVariantField = messages.some((msg) => msg.variant !== undefined && msg.variant !== null);
  if (hasVariantField) {
    const variants = new Map<string, ConversationMessage[]>();
    for (const message of messages) {
      const key = message.variant ?? 'default';
      if (!variants.has(key)) {
        variants.set(key, []);
      }
      variants.get(key)!.push(cloneMessage(message));
    }
    return Array.from(variants.values());
  }

  const containsNonUserRole = messages.some((msg) => msg.role !== 'user');
  if (containsNonUserRole) {
    return [messages.map((msg) => cloneMessage(msg))];
  }

  return messages.map((msg) => [cloneMessage(msg)]);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error === undefined || error === null) {
    return '';
  }
  try {
    return JSON.stringify(error);
  } catch (_error) {
    return String(error);
  }
}

function appendError(existing: string | undefined, addition: string | undefined): string | undefined {
  if (!addition || addition.trim() === '') {
    return existing;
  }
  if (!existing || existing.trim() === '') {
    return addition;
  }
  return `${existing}; ${addition}`;
}

async function runScenarioTools(
  scenario: Scenario,
  envHooks: EnvironmentHooks,
  verbose: boolean,
): Promise<ScenarioExecution> {
  await envHooks.beforeScenario();
  console.log(`\n=== ${scenario.id} ===`);
  const captures: Record<string, unknown> = {};
  const failures: string[] = [];
  const toolCalls: ToolCallLog[] = [];

  for (const [index, step] of scenario.steps.entries()) {
    const stepLabel = step.label ?? `Step ${index + 1}`;
    if (verbose) {
      console.log(`\n→ ${stepLabel}`);
    }

    const resolvedArgs = interpolate(step.arguments ?? {}, captures);
    const call: ToolCall = {
      name: step.tool,
      arguments: resolvedArgs as ToolArguments,
    };

    let response: unknown;
    let status: 'success' | 'error' = 'success';
    let error: unknown;

    try {
      response = await runTool(call);
    } catch (err) {
      status = 'error';
      error = err;
      response = undefined;
    }


    const callLog: ToolCallLog = {
      label: stepLabel,
      name: step.tool,
      arguments: cloneArgs(resolvedArgs as Record<string, unknown>),
      status,
      error: status === 'error' ? formatError(error) : undefined,
    };

    const expectedStatus = step.expect?.status ?? 'success';
    if (status !== expectedStatus) {
      const mismatchMessage = `expected status ${expectedStatus} but received ${status}`;
      failures.push(
        `${stepLabel}: ${mismatchMessage}${
          error ? ` (${(error as Error).message})` : ''
        }`,
      );
      callLog.error = appendError(callLog.error, mismatchMessage);
      if (verbose && error) {
        console.error(error);
      }
      if (status === 'error') {
        toolCalls.push(callLog);
        continue;
      }
    }

    if (status === 'success' && response && step.capture) {
      for (const [token, pathExpression] of Object.entries(step.capture)) {
        captures[token] = getByPath(response, pathExpression);
      }
    }

    if (status === 'success' && step.expect?.assert) {
      for (const assertion of step.expect.assert) {
        const value = getByPath(response, assertion.path);
        const failure = evaluateAssertion(assertion, value, captures);
        if (failure) {
          failures.push(`${stepLabel}: ${failure}`);
          callLog.error = appendError(callLog.error, failure);
        }
      }
    }

    toolCalls.push(callLog);
  }

  const passed = failures.length === 0;
  console.log(passed ? '✅ Passed' : '❌ Failed');

  return {
    result: { scenario: scenario.id, passed, failures },
    toolCalls,
  };
}

async function runScenarioLlm(
  scenario: Scenario,
  envHooks: EnvironmentHooks,
  verbose: boolean,
): Promise<ScenarioExecution[]> {
  console.log(`\n=== ${scenario.id} ===`);

  if (!scenario.conversation || scenario.conversation.length === 0) {
    const failures = [
      'Scenario does not define a conversation script for LLM mode. Add a "conversation" array.',
    ];
    console.log('❌ Failed');
    return [
      {
        result: { scenario: scenario.id, passed: false, failures },
        toolCalls: [],
        transcript: [],
      },
    ];
  }

  await envHooks.beforeScenario();
  const conversationVariants = expandConversationVariants(scenario.conversation);
  const executions: ScenarioExecution[] = [];
  const variantCount = conversationVariants.length;

  for (let idx = 0; idx < variantCount; idx += 1) {
    const script = conversationVariants[idx];
    const variantScenarioId = variantCount > 1 ? `${scenario.id}::variant-${idx + 1}` : scenario.id;
    if (variantCount > 1) {
      console.log(`--- Variant ${idx + 1}/${variantCount}`);
    }

    const execution = await runScenarioLlmVariant({
      scenario,
      script,
      variantScenarioId,
      verbose,
      envHooks,
    });

    executions.push(execution);

    const passed = execution.result.passed;
    if (variantCount > 1) {
      console.log(passed ? '  ✅ Variant passed' : '  ❌ Variant failed');
    } else {
      console.log(passed ? '✅ Passed' : '❌ Failed');
    }
  }

  if (variantCount > 1) {
    const allPassed = executions.every((execution) => execution.result.passed);
    console.log(allPassed ? '✅ All variants passed' : '❌ One or more variants failed');
  }

  return executions;
}

type RunScenarioVariantArgs = {
  scenario: Scenario;
  script: ConversationMessage[];
  variantScenarioId: string;
  verbose: boolean;
  envHooks: EnvironmentHooks;
};

async function runScenarioLlmVariant({
  scenario,
  script,
  variantScenarioId,
  verbose,
  envHooks,
}: RunScenarioVariantArgs): Promise<ScenarioExecution> {
  await envHooks.beforeVariant();
  const failures: string[] = [];
  const captures: Record<string, unknown> = {};
  const toolCalls: ToolCallLog[] = [];

  let sessionResult;
  try {
    sessionResult = await runLlmSession(script, { verbose });
  } catch (error) {
    const message = (error as Error).message ?? 'Unknown LLM session error';
    failures.push(`LLM session failed: ${message}`);
    return {
      result: { scenario: variantScenarioId, passed: false, failures },
      toolCalls,
      transcript: [],
    };
  }

  const invocations = sessionResult.invocations.map((call, index) => ({ ...call, index, matched: false }));
  const transcript = sessionResult.transcript;

  for (let stepIndex = 0; stepIndex < scenario.steps.length; stepIndex += 1) {
    const step = scenario.steps[stepIndex];
    const stepLabel = step.label ?? `Step ${stepIndex + 1}`;

    const match = invocations.find((call) => !call.matched && call.name === step.tool);
    if (!match) {
      const message = `model never called ${step.tool}.`;
      failures.push(`${stepLabel}: ${message}`);
      toolCalls.push({
        label: stepLabel,
        name: step.tool,
        arguments: {},
        status: 'error',
        error: message,
      });
      continue;
    }

    match.matched = true;
    const expectedArgs = interpolate(step.arguments ?? {}, captures) as Record<string, unknown>;
    const actualArgs = (match.arguments ?? {}) as Record<string, unknown>;
    const callLog: ToolCallLog = {
      label: stepLabel,
      name: match.name,
      arguments: cloneArgs(match.arguments as Record<string, unknown>),
      status: match.error ? 'error' : 'success',
      error: match.error,
    };

    if (Object.keys(expectedArgs).length > 0) {
      const argumentFailures = compareArguments(expectedArgs, actualArgs);
      for (const failure of argumentFailures) {
        const message = `argument ${failure}`;
        failures.push(`${stepLabel}: ${message}`);
        callLog.error = appendError(callLog.error, message);
      }
    }

    const expectedStatus = step.expect?.status ?? 'success';
    if (expectedStatus === 'success' && match.error) {
      const message = `tool returned error "${match.error}" but success expected.`;
      failures.push(`${stepLabel}: ${message}`);
      callLog.error = appendError(callLog.error, message);
      toolCalls.push(callLog);
      continue;
    }
    if (expectedStatus === 'error' && !match.error) {
      const message = 'expected tool error but invocation succeeded.';
      failures.push(`${stepLabel}: ${message}`);
      callLog.error = appendError(callLog.error, message);
    }

    if (!match.error && match.response && step.capture) {
      for (const [token, pathExpression] of Object.entries(step.capture)) {
        captures[token] = getByPath(match.response, pathExpression);
      }
    }

    if (!match.error && step.expect?.assert) {
      for (const assertion of step.expect.assert) {
        const value = getByPath(match.response, assertion.path);
        const failure = evaluateAssertion(assertion, value, captures);
        if (failure) {
          failures.push(`${stepLabel}: ${failure}`);
          callLog.error = appendError(callLog.error, failure);
        }
      }
    }

    if (verbose) {
      console.log(`→ ${stepLabel}`);
      console.log(`  - Tool: ${match.name}`);
      console.log(`  - Args: ${JSON.stringify(match.arguments ?? {})}`);
    }

    toolCalls.push(callLog);
  }

  invocations
    .filter((call) => !call.matched)
    .forEach((call) => {
      toolCalls.push({
        label: `Additional tool call ${toolCalls.length + 1}`,
        name: call.name,
        arguments: cloneArgs(call.arguments as Record<string, unknown>),
        status: call.error ? 'error' : 'success',
        error: call.error
          ? appendError(undefined, `additional tool ${call.name} returned error: ${call.error}`)
          : undefined,
      });
    });

  const passed = failures.length === 0;

  return {
    result: { scenario: variantScenarioId, passed, failures },
    toolCalls,
    transcript,
  };
}

function interpolate(input: unknown, captures: Record<string, unknown>): unknown {
  if (typeof input === 'string') {
    return input.replace(/\{\{(.*?)\}\}/g, (_match, token) => {
      const value = captures[token.trim()];
      return value !== undefined ? String(value) : '';
    });
  }

  if (Array.isArray(input)) {
    return input.map((item) => interpolate(item, captures));
  }

  if (input && typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      result[key] = interpolate(value, captures);
    }
    return result;
  }

  return input;
}

function getByPath(data: unknown, pathExpression: string): unknown {
  if (!pathExpression) {
    return undefined;
  }

  const segments = pathExpression.split('.');
  let current: unknown = data;

  for (const segment of segments) {
    if (current === undefined || current === null) {
      return undefined;
    }

    const arrayMatch = segment.match(/(\w+)\[(\d+)\]/);
    if (arrayMatch) {
      const [, key, indexString] = arrayMatch;
      const index = Number(indexString);
      const container = (current as Record<string, unknown>)[key];
      if (!Array.isArray(container) || container[index] === undefined) {
        return undefined;
      }
      current = container[index];
      continue;
    }

    if (Array.isArray(current) && segment === 'length') {
      current = current.length;
      continue;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function evaluateAssertion(assertion: Assertion, value: unknown, captures: Record<string, unknown>): string | null {
  if (assertion.equals !== undefined) {
    const expected = resolveValue(assertion.equals, captures);
    if (!deepEqual(value, expected)) {
      return `expected ${assertion.path} to equal ${JSON.stringify(expected)} but received ${JSON.stringify(value)}`;
    }
  }

  if (assertion.contains !== undefined) {
    const expected = resolveValue(assertion.contains, captures);
    if (typeof value !== 'string' || typeof expected !== 'string' || !value.includes(expected)) {
      return `expected ${assertion.path} to contain "${expected}" but received ${JSON.stringify(value)}`;
    }
  }

  if (assertion.minLength !== undefined) {
    if (!Array.isArray(value) || value.length < assertion.minLength) {
      return `expected ${assertion.path} to have length >= ${assertion.minLength} but received ${Array.isArray(value) ? value.length : typeof value}`;
    }
  }

  if (assertion.exists !== undefined) {
    const exists = value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');
    if (exists !== assertion.exists) {
      return `expected ${assertion.path} existence to be ${assertion.exists} but received ${exists}`;
    }
  }

  if (assertion.isNull !== undefined) {
    const isNull = value === null;
    if (isNull !== assertion.isNull) {
      return `expected ${assertion.path} null state to be ${assertion.isNull} but received ${isNull}`;
    }
  }

  return null;
}

function resolveValue(value: unknown, captures: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const match = value.match(/^\{\{(.*?)\}\}$/);
    if (match) {
      return captures[match[1].trim()];
    }
    return value;
  }
  return value;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((value, index) => deepEqual(value, right[index]));
  }

  if (left && typeof left === 'object' && right && typeof right === 'object') {
    const leftEntries = Object.entries(left as Record<string, unknown>);
    const rightEntries = Object.entries(right as Record<string, unknown>);
    if (leftEntries.length !== rightEntries.length) {
      return false;
    }
    return leftEntries.every(([key, value]) => deepEqual(value, (right as Record<string, unknown>)[key]));
  }

  return false;
}

function compareArguments(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): string[] {
  const failures: string[] = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!(key in actual)) {
      failures.push(`${key} missing`);
      continue;
    }
    const actualValue = actual[key];
    if (!deepEqual(actualValue, expectedValue)) {
      failures.push(
        `${key} expected ${JSON.stringify(expectedValue)} but received ${JSON.stringify(actualValue)}`,
      );
    }
  }
  return failures;
}

function buildDefaultHeaders(): Record<string, string> | undefined {
  const headers = parseHeadersFromEnv('API_DEFAULT_HEADERS', process.env.API_DEFAULT_HEADERS) ?? {};
  const bearer = process.env.API_BEARER_TOKEN;
  if (bearer && !headers.Authorization) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  return Object.keys(headers).length ? headers : undefined;
}

function parseHeadersFromEnv(
  name: string,
  raw: string | undefined,
): Record<string, string> | undefined {
  if (!raw || raw.trim() === '') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${name} must be a JSON object.`);
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === undefined || value === null) {
        continue;
      }
      headers[key] = String(value);
    }
    return headers;
  } catch (error) {
    throw new Error(`${name} must be valid JSON: ${(error as Error).message}`);
  }
}

function parsePositiveInt(name: string, raw: string | undefined, fallback: number): number {
  if (!raw || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}


main().catch((error) => {
  console.error(error);
  process.exit(1);
});
