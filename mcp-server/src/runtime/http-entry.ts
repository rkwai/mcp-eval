#!/usr/bin/env ts-node
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { loadEnv } from '../config/load-env';
import { createMcpServer } from './server';

loadEnv();

interface SessionContext {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

const sessions = new Map<string, SessionContext>();

const host = process.env.MCP_HTTP_HOST ?? '0.0.0.0';
const port = Number.parseInt(process.env.MCP_HTTP_PORT ?? '3030', 10);

function parseCsv(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const entries = value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
  return entries.length ? entries : undefined;
}

const allowedHosts = parseCsv(process.env.MCP_HTTP_ALLOWED_HOSTS);
const allowedOrigins = parseCsv(process.env.MCP_HTTP_ALLOWED_ORIGINS);
const enableDnsProtection = (process.env.MCP_HTTP_ENABLE_DNS_PROTECTION ?? 'false') === 'true';

async function createSession(): Promise<SessionContext> {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    allowedHosts,
    allowedOrigins,
    enableDnsRebindingProtection: enableDnsProtection,
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { server, transport });
      console.log(`[mcp-server] session initialised (${sessionId})`);
    },
    onsessionclosed: (sessionId) => {
      sessions.delete(sessionId);
      console.log(`[mcp-server] session closed (${sessionId})`);
    },
  });

  transport.onerror = (error) => {
    console.error('[mcp-server] transport error', error);
  };

  await server.connect(transport);
  return { server, transport };
}

function notFound(res: ServerResponse) {
  res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({
    jsonrpc: '2.0',
    error: {
      code: -32004,
      message: 'Not Found',
    },
    id: null,
  }));
}

function getSessionId(req: IncomingMessage): string | undefined {
  const header = req.headers['mcp-session-id'];
  if (!header) {
    return undefined;
  }
  if (Array.isArray(header)) {
    return header[0];
  }
  return header;
}

const httpServer = createHttpServer(async (req, res) => {
  if (!req.url || !req.url.startsWith('/mcp')) {
    notFound(res);
    return;
  }

  try {
    const sessionId = getSessionId(req);
    let context: SessionContext | undefined;

    if (!sessionId) {
      if (req.method !== 'POST') {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Initialization requests must use POST and include JSON payload.',
          },
          id: null,
        }));
        return;
      }
      context = await createSession();
    } else {
      context = sessions.get(sessionId);
      if (!context) {
        res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Unknown MCP session.',
          },
          id: null,
        }));
        return;
      }
    }

    await context.transport.handleRequest(req, res);
  } catch (error) {
    console.error('[mcp-server] failed to handle HTTP request', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      }));
    }
  }
});

httpServer.listen(port, host, () => {
  console.log(`[mcp-server] Streamable HTTP server listening on http://${host}:${port}/mcp`);
});

process.on('SIGINT', async () => {
  console.log('\n[mcp-server] shutting down...');
  httpServer.close();
  await Promise.all([...sessions.values()].map(async ({ transport }) => transport.close().catch(() => undefined)));
  sessions.clear();
  process.exit(0);
});
