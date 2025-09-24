import { systemPrompt, runTool } from '../index';
import { TOOL_DEFINITIONS, ToolName, ToolArguments } from '../tools';

export interface StartServerOptions {
  name?: string;
  version?: string;
  description?: string;
  instructions?: string;
  transport?: unknown;
}

/**
 * Bootstraps an MCP server over stdio so MCP-compatible clients can connect.
 * Uses dynamic imports to avoid hard dependency on SDK types until runtime.
 */
export async function startMcpServer(options: StartServerOptions = {}) {
  const [{ McpServer }, { StdioServerTransport }] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/mcp.js'),
    import('@modelcontextprotocol/sdk/server/stdio.js'),
  ]);

  const server = new McpServer({
    name: options.name ?? 'loyalty-support-mcp',
    version: options.version ?? '0.1.0',
    description:
      options.description ??
      'Intent-driven MCP server that fronts loyalty/reward APIs for internal support teams.',
    instructions: options.instructions ?? systemPrompt(),
  });

  for (const definition of Object.values(TOOL_DEFINITIONS)) {
    server.tool({
      name: definition.name,
      description: definition.description,
      inputSchema: definition.inputSchema,
      execute: async ({ arguments: rawArgs }: { arguments: ToolArguments }) => {
        const args = (rawArgs ?? {}) as ToolArguments;
        const result = await runTool({ name: definition.name as ToolName, arguments: args });
        return {
          type: 'json',
          data: result,
        };
      },
    });
  }

  const transport = options.transport ?? new StdioServerTransport();
  await server.connect(transport);
  if (typeof (transport as { start?: () => Promise<void> }).start === 'function') {
    await (transport as { start: () => Promise<void> }).start();
  }
  if (typeof (server as { start?: () => Promise<void> }).start === 'function') {
    await (server as { start: () => Promise<void> }).start();
  }
  return server;
}
