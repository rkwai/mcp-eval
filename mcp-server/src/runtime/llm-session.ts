import { systemPrompt, runTool } from '../index';
import { TOOL_DEFINITIONS, ToolArguments, ToolName, ToolDefinition } from '../tools';

export type LlmMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type SupportedProvider = 'openrouter';

export interface LlmSessionOptions {
  provider?: SupportedProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTurns?: number;
  toolChoice?: 'auto' | 'required';
  verbose?: boolean;
}

export interface TranscriptMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ToolInvocationRecord {
  name: ToolName;
  arguments: ToolArguments;
  response: unknown;
  error?: string;
}

export interface LlmSessionResult {
  transcript: TranscriptMessage[];
  invocations: ToolInvocationRecord[];
}

type OpenRouterChatCompletionResponse = {
  choices: Array<{
    message: OpenRouterChatMessageWithCalls;
    finish_reason?: string;
  }>;
};

type OpenRouterChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenRouterToolCall[];
};

type OpenRouterChatMessageWithCalls = OpenRouterChatMessage & {
  tool_calls?: OpenRouterToolCall[];
};

type OpenRouterToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

const DEFAULT_MAX_TURNS = 8;

export async function runLlmSession(
  script: LlmMessage[],
  options: LlmSessionOptions = {},
): Promise<LlmSessionResult> {
  const provider = options.provider ?? 'openrouter';
  if (provider !== 'openrouter') {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }
  return runOpenRouterSession(script, options);
}

async function runOpenRouterSession(
  script: LlmMessage[],
  options: LlmSessionOptions,
): Promise<LlmSessionResult> {
  const apiKey = options.apiKey ?? process.env.LLM_PROVIDER_API_KEY;
  if (!apiKey) {
    throw new Error('LLM_PROVIDER_API_KEY is required to run LLM-backed evals.');
  }

  const model = options.model ?? process.env.LLM_MODEL;
  if (!model) {
    throw new Error('LLM_MODEL must be set to run LLM-backed evals.');
  }

  const baseUrl = options.baseUrl ?? process.env.LLM_PROVIDER_BASE_URL;
  if (!baseUrl) {
    throw new Error('LLM_PROVIDER_BASE_URL must be set to run LLM-backed evals.');
  }

  const temperature =
    typeof options.temperature === 'number'
      ? options.temperature
      : coerceNumber(process.env.LLM_TEMPERATURE, 0.1);
  const maxTurns = options.maxTurns ?? coerceNumber(process.env.LLM_MAX_TURNS, DEFAULT_MAX_TURNS);

  const messages: OpenRouterChatMessage[] = [
    { role: 'system', content: systemPrompt() },
    ...script.map((entry) => ({ role: entry.role, content: entry.content })),
  ];

  const transcript: TranscriptMessage[] = [{ role: 'system', content: systemPrompt() }];
  for (const entry of script) {
    transcript.push({ role: entry.role, content: entry.content });
  }

  const tools = Object.values(TOOL_DEFINITIONS).map((definition) => ({
    type: 'function',
    function: {
      name: definition.name,
      description: definition.description,
      parameters: definition.inputSchema,
    },
  }));

  const invocations: ToolInvocationRecord[] = [];

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const payload = {
      model,
      temperature,
      messages,
      tools,
      tool_choice: options.toolChoice ?? 'required',
    };

    const response = await callOpenRouterChatCompletion(baseUrl, apiKey, payload);
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('LLM returned no choices.');
    }

    const { message } = choice;
    if (message.tool_calls && message.tool_calls.length > 0) {
      messages.push({
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });

      const summary = buildToolCallSummary(message);
      if (summary) {
        transcript.push({ role: 'assistant', content: summary });
      }

      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name as ToolName;
        const definition = TOOL_DEFINITIONS[toolName];
        const parsedArgs = safeParseToolArguments(toolCall.function.arguments, definition);
        let result: unknown = undefined;
        let error: string | undefined;
        try {
          result = await runTool({ name: toolName, arguments: parsedArgs });
        } catch (toolError) {
          error = (toolError as Error).message ?? 'Unknown tool error';
        }

        invocations.push({ name: toolName, arguments: parsedArgs, response: result, error });

        const toolContent = error ? { error } : result ?? null;
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolContent),
          name: toolName,
        });
        transcript.push({
          role: 'tool',
          content: JSON.stringify({ name: toolName, response: toolContent }),
        });
      }
      continue;
    }

    messages.push({
      role: 'assistant',
      content: message.content ?? '',
    });
    transcript.push({ role: 'assistant', content: message.content ?? '' });

    if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
      break;
    }
  }

  return { transcript, invocations };
}

async function callOpenRouterChatCompletion(
  baseUrl: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<OpenRouterChatCompletionResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Chat completion failed (${response.status}): ${text}`);
  }

  return (await response.json()) as OpenRouterChatCompletionResponse;
}

function buildToolCallSummary(message: OpenRouterChatMessageWithCalls): string {
  const lines: string[] = [];
  if (message.content && message.content.trim().length > 0) {
    lines.push(message.content.trim());
  }
  if (message.tool_calls) {
    for (const call of message.tool_calls) {
      lines.push(`tool_call ${call.function.name}: ${call.function.arguments ?? ''}`);
    }
  }
  return lines.join('\n');
}

function coerceNumber(value: string | undefined, fallback: number): number {
  if (!value || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeParseToolArguments(raw: string, definition?: ToolDefinition): ToolArguments {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ToolArguments;
  } catch (error) {
    const repaired = attemptRepair(raw, definition);
    if (Object.keys(repaired).length > 0) {
      return repaired;
    }
    throw new Error(`Failed to parse tool arguments: ${(error as Error).message}`);
  }
}

function attemptRepair(raw: string, definition?: ToolDefinition): ToolArguments {
  const result: Record<string, unknown> = {};
  if (!definition?.inputSchema || !('properties' in definition.inputSchema)) {
    return result;
  }

  const cleaned = raw.replace(/\s+/g, ' ');

  const properties = definition.inputSchema.properties ?? {};
  for (const [key, schema] of Object.entries(properties)) {
    const value = extractValue(cleaned, key, schema.type ?? 'string');
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

function extractValue(raw: string, key: string, type: string): unknown {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const stringPattern = new RegExp(`${escapedKey}\s*[:=]\s*"([^"]*)"`, 'i');
  const noQuotePattern = new RegExp(`${escapedKey}\s*[:=]\s*([^,}\s]+)`, 'i');

  if (type === 'string' || type === undefined) {
    const match = raw.match(stringPattern) || raw.match(noQuotePattern);
    if (match) {
      return stripMarkers(match[1]);
    }
  }

  if (type === 'number') {
    const match = raw.match(noQuotePattern);
    if (match) {
      const value = parseFloat(stripMarkers(match[1]));
      if (!Number.isNaN(value)) {
        return value;
      }
    }
  }

  if (type === 'boolean') {
    const match = raw.match(noQuotePattern);
    if (match) {
      const normalized = stripMarkers(match[1]).toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
  }

  return undefined;
}

function stripMarkers(value: string): string {
  return value.split('<')[0].replace(/['"]+/g, '').trim();
}
