import OpenAI from 'openai';

import type { ModelId } from '../../types/agent';

type Usage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type CallModelResult = {
  text: string;
  usage: Usage;
};

const MODEL_NAME_BY_ID: Record<ModelId, string> = {
  'gpt5-thinking': 'gpt-5-2025-08-07',
  'kimik2-thinking': 'kimi-k2-thinking',
};

const MOONSHOT_BASE_URL = 'https://api.moonshot.ai/v1';

type KimiContentPart =
  | string
  | {
      type?: string;
      text?: string;
      content?: string;
    };

type KimiResponse = {
  choices?: Array<{
    message?: {
      content?: string | KimiContentPart[];
      reasoning_content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function normalizeContent(content: string | KimiContentPart[] | undefined): string {
  if (!content) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        return part.text ?? part.content ?? '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable.');
  }
  return new OpenAI({ apiKey });
}

// Safety prompt to enforce clean output format (no reasoning in content)
const SAFETY_SYSTEM_PROMPT = `CRITICAL OUTPUT RULE: Your response must ONLY contain the final answer that directly fulfills the request. Do not include your reasoning process, thinking steps, or explanations in your output. Output only the exact content requested, nothing more.`;

async function callMoonshotAPI(
  model: string,
  prompt: string,
): Promise<{ text: string; usage: Usage }> {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    throw new Error('Missing MOONSHOT_API_KEY environment variable.');
  }

  try {
    const response = await fetch(`${MOONSHOT_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: SAFETY_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 8192, // Increased for longer outputs like video scripts
        stream: false,
        // Note: Kimi K2 returns both reasoning_content and content fields
        // We extract only content field below to get final answer
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Moonshot API error ${response.status}: ${errorText || response.statusText}`,
      );
    }

    const data = (await response.json().catch(() => {
      throw new Error('Moonshot API returned invalid JSON.');
    })) as KimiResponse;
    const choice = data?.choices?.[0];
    const message = choice?.message;

    // Extract only the final content (not the reasoning)
    const text = normalizeContent(message?.content);

    const usage: Usage = {
      prompt_tokens: data?.usage?.prompt_tokens ?? 0,
      completion_tokens: data?.usage?.completion_tokens ?? 0,
      total_tokens: data?.usage?.total_tokens ?? 0,
    };

    return { text, usage };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Moonshot API')) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Moonshot API request failed: ${message}`);
  }
}

async function callOpenAI(model: string, prompt: string): Promise<{ text: string; usage: Usage }> {
  try {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const choice = response.choices[0];
    const text = choice?.message?.content ?? '';

    const usage: Usage = {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
    };

    return { text, usage };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`OpenAI request failed: ${message}`);
  }
}

export async function callModel(model: ModelId, prompt: string): Promise<CallModelResult> {
  const modelName = MODEL_NAME_BY_ID[model];

  if (model === 'kimik2-thinking') {
    return callMoonshotAPI(modelName, prompt);
  }

  return callOpenAI(modelName, prompt);
}


