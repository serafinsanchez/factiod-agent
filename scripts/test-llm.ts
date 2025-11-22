import type { ModelId } from '../types/agent';
import { callModel } from '../lib/llm/client';
import { estimateCost } from '../lib/llm/costs';
import { DEFAULT_MODEL_ID, getModelOptions, normalizeModelId } from '../lib/llm/models';

async function main() {
  try {
    const prompt = 'Say hello in one friendly sentence.';
    const argModel = process.argv[2];
    const normalizedArgModel = normalizeModelId(argModel);
    const model: ModelId = normalizedArgModel ?? DEFAULT_MODEL_ID;

    if (argModel && normalizedArgModel === undefined) {
      console.warn(
        `Unknown model "${argModel}". Falling back to ${DEFAULT_MODEL_ID}. Supported models: ${getModelOptions().join(', ')}`,
      );
    }

    console.log(`Sending prompt to ${model}…`);
    const result = await callModel(model, prompt);

    console.log('\n=== Response Text ===');
    console.log(result.text.trim() || '[empty response]');

    console.log('\n=== Usage Metrics ===');
    console.log(result.usage);

    const estimatedCostUsd = estimateCost(
      model,
      result.usage.prompt_tokens,
      result.usage.completion_tokens,
    );

    console.log('\nEstimated cost (USD):', estimatedCostUsd.toFixed(6));
  } catch (error) {
    console.error('Smoke test failed:', error);
    process.exitCode = 1;
  }
}

void main();


