import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { systemPrompt } from '../index';
import { TOOL_CONFIG } from '../tools';

export interface CreateServerOptions {
  name?: string;
  version?: string;
  description?: string;
  instructions?: string;
}

export interface StartServerOptions extends CreateServerOptions {
  transport?: Transport;
}

function serializeResult(result: unknown): string {
  if (result === undefined || result === null) {
    return 'null';
  }
  if (typeof result === 'string') {
    return result;
  }
  try {
    return JSON.stringify(result, null, 2);
  } catch (error) {
    return String(result);
  }
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return `[error] ${error.message}`;
  }
  return `[error] ${String(error)}`;
}

export function createMcpServer(options: CreateServerOptions = {}) {
  const server = new Server({
    name: options.name ?? 'loyalty-support-mcp',
    version: options.version ?? '0.1.0',
  }, {
    capabilities: {
      tools: {
        listChanged: true,
      },
    },
    instructions: options.instructions ?? systemPrompt(),
  });

  // Set up request handlers
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    const tools: Tool[] = Object.values(TOOL_CONFIG).map(config => {
      const jsonSchema = zodToJsonSchema(config.schema, { $refStrategy: 'none' });
      const { $schema: _omit, ...schemaWithoutMeta } = jsonSchema as Record<string, unknown>;
      return {
        name: config.name,
        description: config.description,
        inputSchema: {
          type: 'object',
          ...schemaWithoutMeta,
        },
      };
    });

    return {
      tools,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const config = (TOOL_CONFIG as any)[name];

    if (!config) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
    }

    try {
      const parsed = config.schema.parse(args);
      const data = await config.runner(parsed);
      return {
        content: [{ type: 'text', text: serializeResult(data) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: serializeError(error) }],
        isError: true,
      };
    }
  });

  // Set up notification handlers
  server.oninitialized = () => {
    console.log('[mcp-server] Server initialized successfully');
    server.sendToolListChanged().catch((error) => {
      console.error('[mcp-server] failed to notify tool list change', error);
    });
  };

  return server;
}

/**
 * Bootstraps an MCP server over stdio (or provided transport) so MCP-compatible clients can connect.
 */
export async function startMcpServer(options: StartServerOptions = {}) {
  const server = createMcpServer(options);
  const transport = options.transport ?? new StdioServerTransport();
  await server.connect(transport);
  if (!options.transport) {
    console.log('[mcp-server] Waiting for MCP client connection...');
  }
  return server;
}
