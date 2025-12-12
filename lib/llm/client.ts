import OpenAI from 'openai';

import type { ModelId } from '../../types/agent';
import { SAFETY_SYSTEM_PROMPT } from '@/prompts';

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
  'gpt-5.1-2025-11-13': 'gpt-5.1-2025-11-13',
  'kimik2-thinking': 'kimi-k2-thinking',
  'claude-sonnet-4.5': 'claude-sonnet-4-5',
  'claude-opus-4.5': 'claude-opus-4-5-20251101',
  'gemini-3-pro': 'gemini-3-pro-preview',
};

const MOONSHOT_BASE_URL = 'https://api.moonshot.ai/v1';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

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

type AnthropicContentBlock = {
  type?: string;
  text?: string;
};

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
};

function normalizeAnthropicContent(content?: AnthropicContentBlock[]): string {
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((block) => (typeof block?.text === 'string' ? block.text : ''))
    .filter(Boolean)
    .join('\n');
}

async function callMoonshotAPI(
  model: string,
  prompt: string,
  maxTokens?: number,
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
        max_tokens: maxTokens ?? 8192, // Default 8192, can be increased to 16384 for long outputs
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

async function callOpenAI(
  model: string,
  prompt: string,
  maxTokens?: number,
): Promise<{ text: string; usage: Usage }> {
  try {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model,
      max_tokens: maxTokens ?? 4096,
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

async function callAnthropic(model: string, prompt: string, maxTokens?: number): Promise<{ text: string; usage: Usage }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable.');
  }

  try {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens ?? 4096,
        system: SAFETY_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Anthropic API error ${response.status}: ${errorText || response.statusText}`);
    }

    const data = (await response.json().catch(() => {
      throw new Error('Anthropic API returned invalid JSON.');
    })) as AnthropicResponse;

    const text = normalizeAnthropicContent(data.content);
    const promptTokens = data.usage?.input_tokens ?? 0;
    const completionTokens = data.usage?.output_tokens ?? 0;

    const usage: Usage = {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    };

    return { text, usage };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Anthropic API')) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Anthropic API request failed: ${message}`);
  }
}

function normalizeGeminiContent(candidates?: GeminiCandidate[]): string {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return '';
  }
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return '';
  }
  return parts
    .map((part) => part?.text ?? '')
    .filter(Boolean)
    .join('\n');
}

async function callGemini(
  model: string,
  prompt: string,
  maxTokens?: number,
): Promise<{ text: string; usage: Usage }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  try {
    const response = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini API error ${response.status}: ${errorText || response.statusText}`);
    }

    const data = (await response.json().catch(() => {
      throw new Error('Gemini API returned invalid JSON.');
    })) as GeminiResponse;

    const text = normalizeGeminiContent(data.candidates);
    const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

    const usage: Usage = {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    };

    return { text, usage };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Gemini API')) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API request failed: ${message}`);
  }
}

export async function callModel(model: ModelId, prompt: string, maxTokens?: number): Promise<CallModelResult> {
  const modelName = MODEL_NAME_BY_ID[model];

  if (model === 'kimik2-thinking') {
    return callMoonshotAPI(modelName, prompt, maxTokens);
  }

  if (model === 'claude-sonnet-4.5' || model === 'claude-opus-4.5') {
    return callAnthropic(modelName, prompt, maxTokens);
  }

  if (model === 'gemini-3-pro') {
    return callGemini(modelName, prompt, maxTokens);
  }

  return callOpenAI(modelName, prompt, maxTokens);
}


