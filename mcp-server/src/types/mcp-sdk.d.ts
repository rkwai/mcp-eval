declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  export class McpServer {
    constructor(options: Record<string, unknown>);
    tool(definition: Record<string, unknown>): void;
    connect(transport: unknown): Promise<void>;
    start?(): Promise<void>;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  export class StdioServerTransport {
    constructor();
    start?(): Promise<void>;
  }
}
