import { PROMPTS } from './prompts';
import type { AxOptimizationConfig, SupportProgramName } from './types';

export function resolveOptimizationConfig(flow: SupportProgramName): AxOptimizationConfig {
  const enabled = process.env.AX_GEPA_ENABLED !== 'false';
  const optimizer = (process.env.AX_GEPA_OPTIMIZER as 'gepa' | 'gepa-flow') ?? 'gepa';
  const autoLevel = (process.env.AX_GEPA_AUTO as 'light' | 'medium' | 'heavy') ?? 'light';
  const teacherInstructions = process.env.AX_GEPA_TEACHER ?? PROMPTS[flow].teacher;

  return {
    enabled,
    optimizer,
    autoLevel,
    teacherInstructions,
  };
}

