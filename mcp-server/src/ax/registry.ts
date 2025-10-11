import { ensureProgram, runProgram, type SupportProgramName, type AxOptimizationConfig } from './programs';

export async function runSupportProgram(
  name: SupportProgramName,
  input: Record<string, unknown>,
  optimization?: AxOptimizationConfig,
) {
  await ensureProgram(name);
  return runProgram(name, input, optimization);
}

