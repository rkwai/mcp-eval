import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export type EvalLogEntry = {
  timestamp: string;
  runId: string;
  scenario: string;
  mode: 'tools' | 'llm';
  status: 'passed' | 'failed';
  failures: string[];
  toolCalls: Array<{
    label: string;
    name: string;
    arguments: Record<string, unknown>;
    status: 'success' | 'error';
    error?: string;
  }>;
  transcript?: Array<{ role: string; content: string }>;
};

const LOG_DIR = join(process.cwd(), 'evals', 'logs');

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function writeEvalLog(entry: EvalLogEntry) {
  ensureLogDir();
  const file = join(LOG_DIR, `eval-${entry.scenario}-${entry.runId}.jsonl`);
  const stream = createWriteStream(file, { flags: 'a' });
  stream.write(`${JSON.stringify(entry)}\n`);
  stream.end();
}
