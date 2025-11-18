import type { ModelId } from '../../types/agent';

export const DEFAULT_MODEL_ID: ModelId = 'gpt-5.1-2025-11-13';

export const SUPPORTED_MODEL_IDS: readonly ModelId[] = [
  DEFAULT_MODEL_ID,
  'kimik2-thinking',
] as const;

const LEGACY_MODEL_ALIASES: Record<string, ModelId> = {
  'gpt5-thinking': DEFAULT_MODEL_ID,
};

export function isModelId(value: unknown): value is ModelId {
  return typeof value === 'string' && SUPPORTED_MODEL_IDS.includes(value as ModelId);
}

export function normalizeModelId(value: unknown): ModelId | undefined {
  if (isModelId(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return LEGACY_MODEL_ALIASES[value];
  }

  return undefined;
}

export function getModelOptions(): ModelId[] {
  return [...SUPPORTED_MODEL_IDS];
}


