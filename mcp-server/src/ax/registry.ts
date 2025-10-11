import { ensureProgram, runProgram } from './programs';
import type { SupportProgramName, AxOptimizationConfig } from './types';

export async function runSupportProgram(
  name: SupportProgramName,
  input: Record<string, unknown>,
  optimization?: AxOptimizationConfig,
) {
  await ensureProgram(name);
  return runProgram(name, input, optimization);
}

