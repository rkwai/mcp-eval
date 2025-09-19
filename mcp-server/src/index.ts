export type ToolCall = {
  name: 'run_scenario' | 'export_summary' | 'store_regression';
  arguments: Record<string, unknown>;
};

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

async function callApi<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API call failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function runTool(call: ToolCall) {
  switch (call.name) {
    case 'run_scenario': {
      const { scenarioId } = call.arguments as { scenarioId: string };
      return callApi<{ stats: unknown }>('/metrics/fetch', { scenarioId });
    }
    case 'export_summary': {
      const { runId, audience } = call.arguments as { runId: string; audience: 'internal' | 'customer' };
      return callApi('/reports/summarise', { runId, audience });
    }
    case 'store_regression': {
      const { runId, payload } = call.arguments as { runId: string; payload: unknown };
      return callApi('/artefacts/upload', { runId, artefactType: 'regression', payload });
    }
    default:
      throw new Error(`Unsupported tool: ${call.name}`);
  }
}

export function systemPrompt(): string {
  return (
    'You are an MCP server that ensures REST endpoints are invoked with the correct schema. ' +
    'Always validate required arguments before calling the API service and capture results for eval logging.'
  );
}
