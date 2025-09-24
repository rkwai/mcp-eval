import { systemPrompt, runTool } from '../index';
import { TOOL_DEFINITIONS, ToolArguments, ToolName, ToolDefinition, ToolSchema } from '../tools';

export type LlmMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type SupportedProvider = 'openai' | 'openrouter' | 'gemini';

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

type OpenAiChatCompletionResponse = {
  choices: Array<{
    message: OpenAiChatMessageWithCalls;
    finish_reason?: string;
  }>;
};

type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenAiToolCall[];
};

type OpenAiChatMessageWithCalls = OpenAiChatMessage & {
  tool_calls?: OpenAiToolCall[];
};

type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type GeminiSchema = {
  type: 'OBJECT' | 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'NULL';
  description?: string;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema | GeminiSchema[];
  enum?: unknown[];
};

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args?: Record<string, unknown> | string } }
  | { functionResponse: { name: string; response?: unknown } };

type GeminiContent = {
  role: 'user' | 'model' | 'tool';
  parts: GeminiPart[];
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: GeminiContent;
    finishReason?: string;
  }>;
};

const DEFAULT_MAX_TURNS = 6;

export async function runLlmSession(
  script: LlmMessage[],
  options: LlmSessionOptions = {},
): Promise<LlmSessionResult> {
  const provider = options.provider ?? (process.env.LLM_PROVIDER as SupportedProvider | undefined) ?? 'openai';

  switch (provider) {
    case 'openai':
    case 'openrouter':
      return runOpenAiCompatibleSession(script, { ...options, provider });
    case 'gemini':
      return runGeminiSession(script, { ...options, provider });
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

interface OpenAiSessionOptions extends LlmSessionOptions {
  provider: 'openai' | 'openrouter';
}

async function runOpenAiCompatibleSession(
  script: LlmMessage[],
  options: OpenAiSessionOptions,
): Promise<LlmSessionResult> {
  const provider = options.provider;
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
      : coerceNumber(process.env.LLM_TEMPERATURE, 0);
  const maxTurns = options.maxTurns ?? coerceNumber(process.env.LLM_MAX_TURNS, DEFAULT_MAX_TURNS);

  const messages: OpenAiChatMessage[] = [
    { role: 'system', content: systemPrompt() },
    ...script.map((entry) => ({ role: entry.role, content: entry.content })),
  ];

  const transcript: TranscriptMessage[] = [{ role: 'system', content: systemPrompt() }];
  for (const entry of script) {
    const role = entry.role === 'assistant' ? 'assistant' : entry.role;
    transcript.push({ role, content: entry.content });
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
      tool_choice: options.toolChoice ?? 'auto',
    };

    const response = await callOpenAiChatCompletion(baseUrl, apiKey, payload, provider);
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
        const parsedArgs = safeParseToolArguments(toolCall.function.arguments);
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

async function callOpenAiChatCompletion(
  baseUrl: string,
  apiKey: string,
  payload: Record<string, unknown>,
  _provider: 'openai' | 'openrouter',
): Promise<OpenAiChatCompletionResponse> {
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

  return (await response.json()) as OpenAiChatCompletionResponse;
}

function buildToolCallSummary(message: OpenAiChatMessageWithCalls): string {
  const lines: string[] = [];
  if (message.content && message.content.trim().length > 0) {
    lines.push(message.content.trim());
  }
  if (message.tool_calls) {
    for (const call of message.tool_calls) {
      lines.push(
        `tool_call ${call.function.name}: ${call.function.arguments ?? ''}`,
      );
    }
  }
  return lines.join('\n');
}

interface GeminiSessionOptions extends LlmSessionOptions {
  provider: 'gemini';
}

async function runGeminiSession(
  script: LlmMessage[],
  options: GeminiSessionOptions,
): Promise<LlmSessionResult> {
  const apiKey = options.apiKey ?? process.env.LLM_PROVIDER_API_KEY;
  if (!apiKey) {
    throw new Error('LLM_PROVIDER_API_KEY is required to run Gemini-backed evals.');
  }

  const baseUrl = options.baseUrl ?? process.env.LLM_PROVIDER_BASE_URL;
  if (!baseUrl) {
    throw new Error('LLM_PROVIDER_BASE_URL must be set to run Gemini-backed evals.');
  }
  const endpoint = buildGeminiEndpoint(baseUrl, apiKey);
  const temperature =
    typeof options.temperature === 'number'
      ? options.temperature
      : coerceNumber(process.env.LLM_TEMPERATURE, 0);
  const maxTurns = options.maxTurns ?? coerceNumber(process.env.LLM_MAX_TURNS, DEFAULT_MAX_TURNS);

  const transcript: TranscriptMessage[] = [{ role: 'system', content: systemPrompt() }];
  const contents: GeminiContent[] = [];

  const systemInstruction: GeminiContent = {
    role: 'model',
    parts: [{ text: systemPrompt() }],
  };

  for (const entry of script) {
    if (entry.role === 'system') {
      systemInstruction.parts.push({ text: entry.content });
      transcript.push({ role: 'system', content: entry.content });
      continue;
    }

    const geminiRole: 'user' | 'model' = entry.role === 'assistant' ? 'model' : 'user';
    contents.push({ role: geminiRole, parts: [{ text: entry.content }] });
    transcript.push({ role: entry.role, content: entry.content });
  }

  const functionDeclarations = Object.values(TOOL_DEFINITIONS).map((definition) => ({
    name: definition.name,
    description: definition.description,
    parameters: convertSchemaToGemini(definition),
  }));

  const invocations: ToolInvocationRecord[] = [];

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const requestBody = {
      contents,
      tools: [{ functionDeclarations }],
      systemInstruction,
      generationConfig: {
        temperature,
      },
    };

    const response = await callGeminiGenerateContent(endpoint, requestBody);
    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content) {
      throw new Error('Gemini returned no candidates.');
    }

    const assistantContent = candidate.content;
    contents.push(assistantContent);

    const textSegments = assistantContent.parts
      .filter((part): part is { text: string } => 'text' in part)
      .map((part) => part.text)
      .filter((segment) => segment && segment.trim().length > 0);
    if (textSegments.length > 0) {
      transcript.push({ role: 'assistant', content: textSegments.join('\n') });
    }

    const toolCalls = assistantContent.parts.filter((part): part is { functionCall: { name: string; args?: Record<string, unknown> | string } } =>
      'functionCall' in part,
    );

    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        const toolName = call.functionCall.name as ToolName;
        const parsedArgs = normaliseGeminiArgs(call.functionCall.args);
        let result: unknown = undefined;
        let error: string | undefined;
        try {
          result = await runTool({ name: toolName, arguments: parsedArgs });
        } catch (toolError) {
          error = (toolError as Error).message ?? 'Unknown tool error';
        }

        invocations.push({ name: toolName, arguments: parsedArgs, response: result, error });
        transcript.push({
          role: 'assistant',
          content: `tool_call ${toolName}: ${JSON.stringify(parsedArgs)}`,
        });

        const responseContent: GeminiContent = {
          role: 'tool',
          parts: [
            {
              functionResponse: {
                name: toolName,
                response: error ? { error } : result ?? null,
              },
            },
          ],
        };
        contents.push(responseContent);
        transcript.push({
          role: 'tool',
          content: JSON.stringify({ name: toolName, response: error ? { error } : result ?? null }),
        });
      }
      continue;
    }

    const finishReason = candidate.finishReason?.toUpperCase();
    if (!finishReason || finishReason === 'STOP' || finishReason === 'FINISH' || finishReason === 'MAX_TOKENS') {
      break;
    }
  }

  return { transcript, invocations };
}

function buildGeminiEndpoint(baseUrl: string, apiKey: string): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('key', apiKey);
    return url.toString();
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}key=${apiKey}`;
  }
}

async function callGeminiGenerateContent(endpoint: string, body: unknown): Promise<GeminiGenerateContentResponse> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini generateContent failed (${response.status}): ${text}`);
  }

  return (await response.json()) as GeminiGenerateContentResponse;
}

function convertSchemaToGemini(definition: ToolDefinition): GeminiSchema {
  return mapSchema(definition.inputSchema as ToolSchema);
}

function coerceNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapSchema(schema: ToolSchema): GeminiSchema {
  const type = schema.type?.toLowerCase();
  switch (type) {
    case 'object':
      return {
        type: 'OBJECT',
        description: schema.description,
        properties: schema.properties ? mapProperties(schema.properties) : undefined,
        required: schema.required,
      };
    case 'array':
      return {
        type: 'ARRAY',
        description: schema.description,
        items: Array.isArray(schema.items)
          ? schema.items.map((item) => mapSchema(item as ToolSchema))
          : schema.items
          ? mapSchema(schema.items as ToolSchema)
          : undefined,
      };
    case 'number':
    case 'integer':
      return { type: 'NUMBER', description: schema.description, enum: schema.enum };
    case 'boolean':
      return { type: 'BOOLEAN', description: schema.description, enum: schema.enum };
    case 'string':
      return { type: 'STRING', description: schema.description, enum: schema.enum };
    case 'null':
      return { type: 'NULL', description: schema.description };
    default:
      return { type: 'STRING', description: schema?.description };
  }
}

function mapProperties(properties: Record<string, ToolSchema>): Record<string, GeminiSchema> {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, mapSchema(value)]),
  );
}

function normaliseGeminiArgs(args?: Record<string, unknown> | string): ToolArguments {
  if (!args) {
    return {};
  }
  if (typeof args === 'string') {
    return safeParseToolArguments(args);
  }
  return args as ToolArguments;
}

function safeParseToolArguments(raw: string): ToolArguments {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ToolArguments;
  } catch (error) {
    throw new Error(`Failed to parse tool arguments: ${(error as Error).message}`);
  }
}
