import type { AxEvaluationCapture, SupportProgramName } from './programs';

export interface OptimizationCaptureEntry {
  program: SupportProgramName;
  capture: AxEvaluationCapture;
  timestamp: string;
}

const buffer: OptimizationCaptureEntry[] = [];

export function recordOptimizationCapture(program: SupportProgramName, capture: AxEvaluationCapture) {
  buffer.push({ program, capture, timestamp: new Date().toISOString() });
}

export function drainOptimizationCaptures(): OptimizationCaptureEntry[] {
  if (!buffer.length) {
    return [];
  }
  const entries = buffer.slice();
  buffer.length = 0;
  return entries;
}

