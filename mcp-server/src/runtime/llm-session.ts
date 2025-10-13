import { systemPrompt, runTool } from '../index';
import { TOOL_DEFINITIONS, ToolArguments, ToolName, ToolDefinition } from '../tools';

export type LlmMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type SupportedProvider = 'openrouter' | 'ollama';

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
  const provider = resolveProvider(options.provider ?? process.env.LLM_PROVIDER);
  return runChatCompletionSession(provider, script, options);
}

async function runChatCompletionSession(
  provider: SupportedProvider,
  script: LlmMessage[],
  options: LlmSessionOptions,
): Promise<LlmSessionResult> {
  const requireApiKey = provider !== 'ollama';
  const providedKey = options.apiKey ?? process.env.LLM_PROVIDER_API_KEY;
  const apiKey = requireApiKey ? providedKey : providedKey ?? undefined;

  if (requireApiKey && !apiKey) {
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
  const endpoint = normalizeChatCompletionUrl(baseUrl, provider);

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

    const response = await callChatCompletion(endpoint, apiKey, payload);
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

        const storedResult = deepClone(result);
        invocations.push({ name: toolName, arguments: parsedArgs, response: storedResult, error });

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

async function callChatCompletion(
  url: string,
  apiKey: string | undefined,
  payload: Record<string, unknown>,
): Promise<OpenRouterChatCompletionResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
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
  if (!raw) {
    return {};
  }

  const sanitised = sanitizeRawArguments(raw);

  try {
    const parsed = JSON.parse(sanitised) as ToolArguments;
    return postProcessArguments(parsed, definition);
  } catch (error) {
    const repaired = attemptRepair(sanitised, definition);
    if (Object.keys(repaired).length > 0) {
      return postProcessArguments(repaired, definition);
    }
    throw new Error(
      `Failed to parse tool arguments: ${(error as Error).message}; raw=${truncateForError(sanitised)}`,
    );
  }
}

function attemptRepair(raw: string, definition?: ToolDefinition): ToolArguments {
  const result: Record<string, unknown> = {};
  if (!definition?.inputSchema || !('properties' in definition.inputSchema)) {
    return result;
  }

  const cleaned = normalizeForExtraction(raw);

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
  const singleQuotePattern = new RegExp(`${escapedKey}\s*[:=]\s*'([^']*)'`, 'i');
  const noQuotePattern = new RegExp(`${escapedKey}\s*[:=]\s*([^,}\s]+)`, 'i');
  const xmlPattern = new RegExp(`<parameter[^>]*name=["']${escapedKey}["'][^>]*>([^<]*)`, 'i');
  const loosePattern = new RegExp(`${escapedKey}[^A-Za-z0-9_]+([^,}\s]+)`, 'i');

  const cleanedRaw = raw
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/&quot;/g, '"');

  if (type === 'string' || type === undefined) {
    const match =
      cleanedRaw.match(stringPattern) ||
      cleanedRaw.match(singleQuotePattern) ||
      cleanedRaw.match(xmlPattern) ||
      cleanedRaw.match(noQuotePattern) ||
      cleanedRaw.match(loosePattern);
    if (match) {
      return stripMarkers(match[1]);
    }
  }

  if (type === 'number') {
    const match =
      cleanedRaw.match(noQuotePattern) ||
      cleanedRaw.match(singleQuotePattern) ||
      cleanedRaw.match(stringPattern) ||
      cleanedRaw.match(loosePattern);
    const numeric = coerceNumericValue(match ? stripMarkers(match[1]) : undefined);
    if (numeric !== undefined) {
      return numeric;
    }
  }

  if (type === 'boolean') {
    const match =
      cleanedRaw.match(noQuotePattern) ||
      cleanedRaw.match(singleQuotePattern) ||
      cleanedRaw.match(stringPattern);
    if (match) {
      const normalized = stripMarkers(match[1]).toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
  }

  return undefined;
}

function stripMarkers(value: string): string {
  return value
    .replace(/<\/?.*?>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeRawArguments(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/\r?\n/g, ' ');
  cleaned = cleaned.replace(/\t/g, ' ');
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/[“”]/g, '"');
  cleaned = cleaned.replace(/[‘’]/g, "'");
  cleaned = cleaned.replace(/<\/?.*?>/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');

  const firstBrace = cleaned.indexOf('{');
  if (firstBrace >= 0) {
    const lastBrace = cleaned.lastIndexOf('}');
    cleaned = lastBrace >= 0 ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned.slice(firstBrace);
  }

  if (!cleaned.startsWith('{') && cleaned.includes(':')) {
    cleaned = `{${cleaned.replace(/^,/, '')}}`;
  }

  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  cleaned = cleaned.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
  cleaned = cleaned.replace(/([{,]\s*)"([A-Za-z0-9_]+)"\s*=\s*/g, '$1"$2": ');

  if (cleaned.includes('=')) {
    cleaned = cleaned
      .replace(
        /([{,]\s*)([A-Za-z0-9_]+)\s*=\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g,
        (_match, prefix, key, value) => `${prefix}"${key}": "${escapeForJson(value)}"`,
      )
      .replace(
        /([{,]\s*)([A-Za-z0-9_]+)\s*=\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g,
        (_match, prefix, key, value) => `${prefix}"${key}": "${escapeForJson(value)}"`,
      )
      .replace(
        /([{,]\s*)([A-Za-z0-9_]+)\s*=\s*([^,}\s]+)/g,
        (_match, prefix, key, value) => {
          const trimmedValue = value.trim();
          if (/^-?\d+(?:\.\d+)?$/.test(trimmedValue) || /^(true|false|null)$/i.test(trimmedValue)) {
            return `${prefix}"${key}": ${trimmedValue}`;
          }
          return `${prefix}"${key}": "${escapeForJson(trimmedValue)}"`;
        },
      );
  }

  const openBraces = (cleaned.match(/{/g) ?? []).length;
  const closeBraces = (cleaned.match(/}/g) ?? []).length;
  if (openBraces > closeBraces) {
    cleaned += '}'.repeat(openBraces - closeBraces);
  }

  return cleaned;
}

const SUPPORTED_PROVIDERS: SupportedProvider[] = ['openrouter', 'ollama'];

function resolveProvider(candidate?: string | null): SupportedProvider {
  if (!candidate || candidate.trim().length === 0) {
    return 'openrouter';
  }

  const normalised = candidate.trim().toLowerCase();
  if ((SUPPORTED_PROVIDERS as string[]).includes(normalised)) {
    return normalised as SupportedProvider;
  }

  throw new Error(`Unsupported LLM provider: ${candidate}`);
}

function normalizeChatCompletionUrl(baseUrl: string, provider: SupportedProvider): string {
  const trimmed = baseUrl.trim();
  if (trimmed.length === 0) {
    throw new Error('LLM_PROVIDER_BASE_URL must not be empty.');
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (withoutTrailingSlash.toLowerCase().endsWith('/chat/completions')) {
    return withoutTrailingSlash;
  }

  if (provider === 'ollama') {
    if (withoutTrailingSlash.toLowerCase().endsWith('/v1')) {
      return `${withoutTrailingSlash}/chat/completions`;
    }
    return `${withoutTrailingSlash}/v1/chat/completions`;
  }

  return `${withoutTrailingSlash}/chat/completions`;
}

function normalizeForExtraction(raw: string): string {
  return raw
    .replace(/\r?\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<\/?.*?>/g, ' ');
}

function postProcessArguments(args: ToolArguments, definition?: ToolDefinition): ToolArguments {
  if (!definition?.inputSchema || !('properties' in (definition.inputSchema as Record<string, unknown>))) {
    return normaliseLoose(args) as ToolArguments;
  }

  const schemaObject = definition.inputSchema as {
    properties?: Record<string, { type?: string }>;
  };
  const properties = schemaObject.properties ?? {};
  const output: Record<string, unknown> = {};
  const source = normaliseLoose(args) as Record<string, unknown>;

  for (const [key, value] of Object.entries(source)) {
    const schema = properties[key];
    output[key] = normaliseValueBySchema(value, schema);
  }

  return output as ToolArguments;
}

function normaliseLoose(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normaliseLoose(entry));
  }
  if (value && typeof value === 'object') {
    const mapped: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      mapped[key] = normaliseLoose(entry);
    }
    return mapped;
  }
  if (typeof value === 'string') {
    return stripMarkers(value);
  }
  return value;
}

function normaliseValueBySchema(value: unknown, schema?: { type?: string }): unknown {
  if (schema?.type === 'number' || schema?.type === 'integer') {
    const coerced = coerceNumericValue(value);
    return coerced !== undefined ? coerced : value;
  }
  if (schema?.type === 'boolean') {
    const coerced = coerceBoolean(value);
    return coerced !== undefined ? coerced : value;
  }
  if (schema?.type === 'string') {
    return typeof value === 'string' ? stripMarkers(value) : value;
  }
  if (schema?.type === 'object' && value && typeof value === 'object') {
    return normaliseLoose(value);
  }
  if (schema?.type === 'array' && Array.isArray(value)) {
    return value.map((entry) => normaliseLoose(entry));
  }
  return normaliseLoose(value);
}

function coerceNumericValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const cleaned = stripMarkers(value);
    const match = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = stripMarkers(value).toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
}

function deepClone<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch (_error) {
      // Fall through to return original reference when cloning fails (functions, circular refs, etc.)
    }
  }
  return value;
}

function truncateForError(raw: string, limit = 200): string {
  const trimmed = raw.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit)}…`;
}

function escapeForJson(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
