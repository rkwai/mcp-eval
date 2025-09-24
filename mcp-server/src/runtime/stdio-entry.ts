#!/usr/bin/env ts-node
import { startMcpServer } from './server';

startMcpServer()
  .then(() => {
    // stdio transport keeps the process alive; no-op here.
  })
  .catch((error) => {
    console.error('[mcp-server] failed to start', error);
    process.exit(1);
  });
