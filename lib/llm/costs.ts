import type { ModelId } from '../../types/agent';

type TokenPricing = {
  input: number;
  output: number;
  cachedInput?: number;
};

export const TOKENS_PER_MILLION = 1_000_000;

export const PRICES: Record<ModelId, TokenPricing> = {
  'gpt5-thinking': {
    input: 1.25, // USD per 1M input tokens (cache miss)
    cachedInput: 0.125, // USD per 1M cached input tokens (cache hit)
    output: 10.0, // USD per 1M output tokens
  },
  'kimik2-thinking': {
    input: 0.6, // USD per 1M input tokens (cache miss)
    cachedInput: 0.15, // USD per 1M cached input tokens (cache hit)
    output: 2.5, // USD per 1M output tokens
  },
};

export function estimateCost(
  model: ModelId,
  promptTokens: number,
  completionTokens: number,
  cachedPromptTokens = 0,
): number {
  const pricing = PRICES[model];

  const cacheHitTokens = Math.max(cachedPromptTokens, 0);
  const cacheMissTokens = Math.max(promptTokens - cacheHitTokens, 0);

  const cachedRate = pricing.cachedInput ?? pricing.input;

  const inputCost =
    (cacheMissTokens * pricing.input + cacheHitTokens * cachedRate) /
    TOKENS_PER_MILLION;
  const outputCost = (completionTokens * pricing.output) / TOKENS_PER_MILLION;

  return inputCost + outputCost;
}
