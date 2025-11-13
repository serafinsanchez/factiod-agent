import { callModel } from '../lib/llm/client';
import { estimateCost } from '../lib/llm/costs';

async function main() {
  try {
    const prompt = 'Say hello in one friendly sentence.';
    const model = 'kimik2-thinking';

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


