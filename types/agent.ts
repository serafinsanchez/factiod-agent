export type ModelId = 'gpt5-thinking' | 'kimik2-thinking';

export type StepId =
  | 'keyConcepts'
  | 'hook'
  | 'quizzes'
  | 'script'
  | 'narrationClean'
  | 'titleDescription'
  | 'thumbnail';

export type VariableKey =
  | 'Topic'
  | 'KeyConcepts'
  | 'HookScript'
  | 'QuizInfo'
  | 'VideoScript'
  | 'NarrationScript'
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
  hidden?: boolean; // If true, step is internal and not shown in UI
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
  narrationScript?: string;
  title?: string;
  description?: string;
  thumbnailPrompt?: string;
  steps: Record<StepId, StepRunState>;
  model: ModelId;
  totalTokens: number;
  totalCostUsd: number;
}

