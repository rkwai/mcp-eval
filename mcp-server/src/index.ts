import { resolveTool, ToolArguments, ToolName } from './tools';
import { configureHttpAdapter } from './client/api';
import { mockHttpAdapter } from './client/mock-adapter';

// Default to mock adapter so evals can run without external APIs.
configureHttpAdapter(mockHttpAdapter);

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
    'You are the Support Assistant MCP server for the loyalty program.',
    'Provide internal support agents with concise answers and orchestrate loyalty API calls via high-level tools.',
    'Available tools cover customer lookup, activity summaries, goodwill adjustments, reward redemptions, catalog snapshots, and restocking.',
    'Validate inputs, document metadata for audit trails, and return structured JSON so evals can assert behaviour.',
  ].join(' ');
}
