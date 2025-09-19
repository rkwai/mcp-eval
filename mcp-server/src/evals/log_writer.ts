import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export type EvalLogEntry = {
  timestamp: string;
  run_id: string;
  scenario: string;
  tool_calls: Array<{ name: string; arguments: Record<string, unknown>; status: 'success' | 'error' }>;
  status: 'passed' | 'failed';
};

const LOG_DIR = join(process.cwd(), 'evals', 'logs');

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function writeEvalLog(entry: EvalLogEntry) {
  ensureLogDir();
  const file = join(LOG_DIR, `eval-${entry.scenario}-${entry.run_id}.jsonl`);
  const stream = createWriteStream(file, { flags: 'a' });
  stream.write(`${JSON.stringify(entry)}\n`);
  stream.end();
}
