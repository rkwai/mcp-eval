#!/usr/bin/env ts-node
/// <reference path="../src/types/yargs.d.ts" />
import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runTool, ToolCall } from '../src';
import { ToolName, ToolArguments } from '../src/tools';

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
};

type EvalResult = {
  scenario: string;
  passed: boolean;
  failures: string[];
};

const scenarioDir = path.join(__dirname, '..', 'evals', 'scenarios');

async function main() {
  await ensureApiAvailable();
  const argv = await yargs(hideBin(process.argv))
    .option('scenario', {
      type: 'string',
      describe: 'Run a single scenario (by id). Runs all when omitted.',
    })
    .option('verbose', {
      type: 'boolean',
      default: false,
    })
    .parse();

  const scenarios = loadScenarios(argv.scenario);
  if (scenarios.length === 0) {
    console.error('No scenarios matched your selection.');
    process.exit(1);
  }

  const results: EvalResult[] = [];
  for (const scenario of scenarios) {
    const result = await runScenario(scenario, argv.verbose ?? false);
    results.push(result);
  }

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  console.log('\n=== Eval Summary ===');
  console.log(`Scenarios run: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    for (const result of results.filter((r) => !r.passed)) {
      console.log(`\n❌ ${result.scenario}`);
      result.failures.forEach((failure) => console.log(`  - ${failure}`));
    }
    process.exit(1);
  }
}

async function ensureApiAvailable() {
  const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
  const healthUrl = `${baseUrl.replace(/\/$/, '')}/health`;

  try {
    const response = await fetch(healthUrl, { method: 'GET', redirect: 'follow' });
    if (!response.ok) {
      console.warn(
        `API health check responded with ${response.status}. Start the API service or override API_BASE_URL before running evals.`,
      );
      process.exit(1);
    }
  } catch (error) {
    console.warn(
      `Unable to reach API at ${healthUrl}. Start the API service or override API_BASE_URL before running evals.`,
    );
    if ((error as Error).message) {
      console.warn((error as Error).message);
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

async function runScenario(scenario: Scenario, verbose: boolean): Promise<EvalResult> {
  console.log(`\n=== ${scenario.id} ===`);
  const captures: Record<string, unknown> = {};
  const failures: string[] = [];

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

    const expectedStatus = step.expect?.status ?? 'success';
    if (status !== expectedStatus) {
      failures.push(
        `${stepLabel}: expected status ${expectedStatus} but received ${status}${
          error ? ` (${(error as Error).message})` : ''
        }`,
      );
      if (verbose && error) {
        console.error(error);
      }
      if (status === 'error') {
        // Do not process captures/assertions when the tool failed unexpectedly.
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
        }
      }
    }
  }

  if (failures.length === 0) {
    console.log('✅ Passed');
    return { scenario: scenario.id, passed: true, failures: [] };
  }

  console.log('❌ Failed');
  return { scenario: scenario.id, passed: false, failures };
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
