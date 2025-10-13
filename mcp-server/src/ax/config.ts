import { PROMPTS } from './prompts';
import type { AxOptimizationConfig, SupportProgramName } from './types';

export function resolveOptimizationConfig(flow: SupportProgramName): AxOptimizationConfig {
  const enabledEnv = process.env.AX_GEPA_ENABLED ?? 'false';
  const enabled = enabledEnv !== 'false';
  const optimizer = (process.env.AX_GEPA_OPTIMIZER ?? 'gepa') as 'gepa' | 'gepa-flow';
  const autoLevel = (process.env.AX_GEPA_AUTO ?? 'light') as 'light' | 'medium' | 'heavy';
  const teacherInstructions = process.env.AX_GEPA_TEACHER ?? process.env.GEPA_TEACHER_INSTRUCTIONS ?? PROMPTS[flow].teacher;

  return {
    enabled,
    optimizer,
    autoLevel,
    teacherInstructions,
  };
}

