import { resolveTool, ToolArguments, ToolName } from './tools';

export type ToolCall = {
  name: ToolName;
  arguments: ToolArguments;
};

export async function runTool(call: ToolCall) {
  const runner = resolveTool(call.name);
  return runner(call.arguments);
}

export function systemPrompt(): string {
  return [
    'You are an MCP server that orchestrates a Dungeon Master gameplay API.',
    'Expose GM-grade tools instead of raw REST verbs, and ensure requests honour the domain contracts.',
    'Available tools include session orchestration (session.startAdventure, session.progressAdventure), story board management, party management, and world intel endpoints.',
    'Validate arguments before invoking the underlying API and return structured JSON responses so evals can assert behaviour.',
  ].join(' ');
}
