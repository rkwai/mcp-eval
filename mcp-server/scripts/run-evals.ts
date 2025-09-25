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
};

const scenarioDir = path.join(__dirname, '..', 'evals', 'scenarios');

function createRunId() {
  return `${Date.now().toString(36)}-${randomUUID()}`;
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
    .option('llm', {
      type: 'boolean',
      default: false,
      describe: 'Run scenarios with an LLM choosing tools (defaults to deterministic tool harness).',
    })
    .parse();

  const useLlm = Boolean(argv.llm);
  if (useLlm) {
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
    const execution =
      useLlm
        ? await runScenarioLlm(scenario, argv.verbose ?? false)
        : await runScenarioTools(scenario, argv.verbose ?? false);
    executions.push(execution);

    if (loggingEnabled) {
      writeEvalLog({
        timestamp: new Date().toISOString(),
        runId: createRunId(),
        scenario: scenario.id,
        mode: useLlm ? 'llm' : 'tools',
        status: execution.result.passed ? 'passed' : 'failed',
        failures: execution.result.failures,
        toolCalls: execution.toolCalls,
        transcript: execution.transcript?.map((entry) => ({ role: entry.role, content: entry.content })),
      });
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

async function runScenarioTools(scenario: Scenario, verbose: boolean): Promise<ScenarioExecution> {
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
  verbose: boolean,
): Promise<ScenarioExecution> {
  console.log(`\n=== ${scenario.id} ===`);
  const failures: string[] = [];
  const captures: Record<string, unknown> = {};
  const toolCalls: ToolCallLog[] = [];

  if (!scenario.conversation || scenario.conversation.length === 0) {
    failures.push('Scenario does not define a conversation script for LLM mode. Add a "conversation" array.');
    console.log('❌ Failed');
    return {
      result: { scenario: scenario.id, passed: false, failures },
      toolCalls,
      transcript: [],
    };
  }

  let sessionResult;
  try {
    sessionResult = await runLlmSession(scenario.conversation, { verbose });
  } catch (error) {
    const message = (error as Error).message ?? 'Unknown LLM session error';
    failures.push(`LLM session failed: ${message}`);
    console.log('❌ Failed');
    return {
      result: { scenario: scenario.id, passed: false, failures },
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
    const callLog: ToolCallLog = {
      label: stepLabel,
      name: match.name,
      arguments: cloneArgs(match.arguments as Record<string, unknown>),
      status: match.error ? 'error' : 'success',
      error: match.error,
    };


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
        error: call.error ? appendError(undefined, `additional tool ${call.name} returned error: ${call.error}`) : undefined,
      });
    });

  const passed = failures.length === 0;
  console.log(passed ? '✅ Passed' : '❌ Failed');

  return {
    result: { scenario: scenario.id, passed, failures },
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


main().catch((error) => {
  console.error(error);
  process.exit(1);
});
