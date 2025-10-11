export type SupportProgramName =
  | 'snapshot'
  | 'issueGoodwill'
  | 'assignOffer'
  | 'claimOffer'
  | 'redeemReward'
  | 'restockReward';

export interface PromptConfig {
  teacher: string;
  student: string;
}

export interface AxOptimizationConfig {
  enabled: boolean;
  optimizer: 'gepa' | 'gepa-flow';
  autoLevel?: 'light' | 'medium' | 'heavy';
  teacherInstructions?: string;
}

export interface AxEvaluationCapture {
  progress: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  paretoFront?: Array<Record<string, unknown>>;
  scoreHistory?: number[];
  configurationHistory?: Array<Record<string, unknown>>;
}

