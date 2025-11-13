export type ModelId = 'gpt5-thinking' | 'kimik2-thinking';

export type StepId =
  | 'keyConcepts'
  | 'hook'
  | 'quizzes'
  | 'script'
  | 'titleDescription'
  | 'thumbnail';

export type VariableKey =
  | 'Topic'
  | 'KeyConcepts'
  | 'HookScript'
  | 'QuizInfo'
  | 'VideoScript'
  | 'Title'
  | 'Description'
  | 'ThumbnailPrompt';

export interface StepConfig {
  id: StepId;
  label: string;
  defaultModel: ModelId;
  promptTemplate: string;
  inputVars: VariableKey[];
  outputVars: VariableKey[];
}

export interface StepRunMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface StepRunState {
  id: StepId;
  resolvedPrompt: string;
  responseText: string;
  status: 'idle' | 'running' | 'success' | 'error';
  errorMessage?: string;
  metrics?: StepRunMetrics;
}

export interface PipelineState {
  topic: string;
  keyConcepts?: string;
  hookScript?: string;
  quizInfo?: string;
  videoScript?: string;
  title?: string;
  description?: string;
  thumbnailPrompt?: string;
  steps: Record<StepId, StepRunState>;
  model: ModelId;
  totalTokens: number;
  totalCostUsd: number;
}

