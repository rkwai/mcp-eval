import { resolveTool, ToolArguments, ToolName } from './tools';
import { useTransport } from './client/support-adapter';
import { createMockTransport } from './client/mock-transport';
import { SYSTEM_PROMPT } from './ax/prompts';

// Default to mock transport so evals can run without external APIs.
useTransport(createMockTransport());

export type ToolCall = {
  name: ToolName;
  arguments: ToolArguments;
};

export async function runTool(call: ToolCall) {
  const runner = resolveTool(call.name);
  return runner(call.arguments);
}

export function systemPrompt(): string {
  return SYSTEM_PROMPT;
}
