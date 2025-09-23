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
    'You are the Support Assistant MCP server for the loyalty program.',
    'Provide internal support agents with concise answers and orchestrate loyalty API calls via high-level tools.',
    'Available tools cover customer lookup, activity summaries, goodwill adjustments, reward redemptions, catalog snapshots, and restocking.',
    'Validate inputs, document metadata for audit trails, and return structured JSON so evals can assert behaviour.',
  ].join(' ');
}
