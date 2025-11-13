# Kimi K2 API Integration Guide

This document provides comprehensive context for integrating with Moonshot AI's Kimi K2 Thinking model API. It covers authentication, request/response structures, utility functions, error handling, and usage patterns based on a production implementation.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Request Structure](#request-structure)
5. [Response Structure](#response-structure)
6. [Core Functions](#core-functions)
7. [Usage Patterns](#usage-patterns)
8. [Error Handling](#error-handling)
9. [Token Usage & Cost Calculation](#token-usage--cost-calculation)
10. [Response Parsing](#response-parsing)
11. [Example Implementations](#example-implementations)

---

## Overview

The Kimi K2 Thinking model (`kimi-k2-thinking`) is accessed through Moonshot AI's API. It's a thinking/reasoning model that can produce both direct outputs and reasoning content, making it suitable for complex tasks requiring structured outputs.

**Key Characteristics:**
- Model ID: `kimi-k2-thinking`
- Base URL: `https://api.moonshot.ai/v1`
- Supports reasoning content (thinking process)
- Returns structured responses with usage metrics
- Pricing: $0.60 per 1M input tokens, $2.50 per 1M output tokens

---

## Authentication

All API requests require a Bearer token in the Authorization header:

```typescript
headers: {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
}
```

**Environment Variable:**
- Store your API key in `MOONSHOT_API_KEY` environment variable
- Never expose the API key in client-side code

---

## API Endpoints

### Chat Completions
**Endpoint:** `POST https://api.moonshot.ai/v1/chat/completions`

The primary endpoint for chat-based interactions with the model.

### Token Estimation (Optional)
**Endpoint:** `POST https://api.moonshot.ai/v1/tokenizers/estimate`

Used to estimate token usage when the response doesn't include usage metrics.

---

## Request Structure

### Basic Request Payload

```typescript
{
  model: "kimi-k2-thinking",
  messages: [
    { role: "system", content: "System prompt here" },
    { role: "user", content: "User message here" }
  ],
  temperature: 0.4,        // 0.0 to 2.0, controls randomness
  max_tokens: 1024,        // Maximum tokens in response
  stream: false            // Set to false for non-streaming
}
```

### Message Roles

- **system**: Instructions and context for the model
- **user**: User input/query
- **assistant**: (Optional) Previous assistant responses for conversation context

### Common Parameters

- **temperature**: `0.0` (deterministic) to `2.0` (creative)
  - Use `0.4` for structured outputs
  - Use `0.5-0.7` for creative content
- **max_tokens**: Maximum response length
  - `1024` for short structured outputs
  - `4096` for longer content (hooks, scripts)
- **stream**: `false` for standard requests (recommended)

---

## Response Structure

### Success Response

```typescript
{
  choices: [
    {
      message: {
        content: string | ContentPart[],  // Main output
        reasoning_content?: string         // Thinking process (if available)
      },
      finish_reason?: string               // "stop", "length", etc.
    }
  ],
  usage?: {
    prompt_tokens: number,
    completion_tokens: number,
    total_tokens: number
  }
}
```

### Content Part Structure

The `content` field can be:
- A simple string
- An array of content parts:
  ```typescript
  {
    type?: string,
    text?: string,
    content?: string
  }
  ```

### Finish Reasons

- `"stop"`: Model completed normally
- `"length"`: Response was truncated due to `max_tokens`
- Other values indicate errors or special conditions

---

## Core Functions

### 1. Main API Call Function

```typescript
async function callMoonshot(
  apiKey: string,
  payload: Record<string, unknown>,
  options?: {
    tag?: string;                    // For logging/debugging
    timeoutMs?: number;              // Default: 120000 (2 minutes)
    maxRetries?: number;             // Default: 2
    retryableErrorCodes?: string[]; // Network error codes to retry
  }
): Promise<MoonshotSuccess | MoonshotError>
```

**Returns:**
- **Success**: `{ type: "success", data: KimiResponse, usage: UsageBreakdown, rawUsage: RawUsage | null }`
- **Error**: `{ type: "error", response: NextResponse, responseWithContext: (context) => NextResponse }`

**Features:**
- Automatic retries on network errors
- Timeout handling
- Usage tracking and cost calculation
- Graceful error handling

### 2. Extract Text from Response

```typescript
function extractChoiceText(
  choice: Choice,
  topic: string,
  options?: {
    allowReasoningFallback?: boolean;  // Default: true
  }
): string
```

Extracts text content from various response formats:
- Checks `message.content` first
- Falls back to `message.reasoning_content` if enabled
- Handles string, array, and object formats
- Returns empty string if no content found

### 3. Normalize Content

```typescript
function normalizeContent(
  content: string | KimiContentPart[] | undefined
): string
```

Converts various content formats to a single string:
- Handles strings directly
- Extracts text from content part arrays
- Filters empty fragments
- Joins with newlines

### 4. Prompt Hydration

```typescript
function hydratePrompt(
  template: string,
  replacements: Record<string, string>
): string
```

Replaces placeholders in prompt templates:
- Format: `[KeyName]` in template
- Case-insensitive matching
- Example: `hydratePrompt("Topic: [Topic]", { Topic: "Dinosaurs" })`

### 5. Read Prompt File

```typescript
async function readPromptFile(relativePath: string): Promise<string>
```

Reads prompt templates from the filesystem:
- Takes relative path from project root
- Returns file contents as string
- Useful for maintaining prompts separately

---

## Usage Patterns

### Pattern 1: Simple Concept Extraction

```typescript
const apiKey = process.env.MOONSHOT_API_KEY;
const payload = {
  model: "kimi-k2-thinking",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "system", content: safetyPrompt },  // Optional: enforce output format
    { role: "user", content: userInput }
  ],
  temperature: 0.4,
  max_tokens: 1024,
  stream: false
};

const result = await callMoonshot(apiKey, payload, { tag: "concepts" });
if (result.type === "error") {
  return result.response;
}

const { data, usage } = result;
const choice = data?.choices?.[0];
const content = extractChoiceText(choice, topic);
```

### Pattern 2: Multi-Step Generation with Reasoning

```typescript
// Step 1: Generate concepts
const conceptPayload = {
  model: "kimi-k2-thinking",
  messages: [
    { role: "system", content: conceptPrompt },
    { role: "user", content: topic }
  ],
  temperature: 0.4,
  max_tokens: 1024
};

const conceptResult = await callMoonshot(apiKey, conceptPayload);
// ... extract concepts ...

// Step 2: Generate hook using concepts
const hookPayload = {
  model: "kimi-k2-thinking",
  messages: [
    { role: "system", content: hookPrompt },
    { role: "user", content: `Topic: ${topic}\nConcepts:\n${concepts.join("\n")}` }
  ],
  temperature: 0.5,
  max_tokens: 4096,  // Longer for complete scripts
  stream: false
};

const hookResult = await callMoonshot(apiKey, hookPayload, {
  tag: "hook",
  timeoutMs: 300000,  // 5 minutes for longer generations
  maxRetries: 3
});
```

### Pattern 3: Handling Reasoning Content

The model may output reasoning separately. Always check both:

```typescript
const choice = data?.choices?.[0];
const message = choice?.message;

// Primary content
const mainContent = normalizeContent(message?.content);

// Reasoning content (thinking process)
const reasoningContent = message?.reasoning_content;

// Extract from reasoning if main content is empty/truncated
if ((!mainContent || isTruncated) && reasoningContent) {
  const extracted = extractFromReasoning(reasoningContent);
  // Use extracted content
}
```

---

## Error Handling

### Network Errors

The `callMoonshot` function automatically retries on:
- `ECONNRESET`
- `ETIMEDOUT`
- `ENOTFOUND`
- `ECONNREFUSED`
- Timeout errors (AbortError)

**Retry Strategy:**
- Default: 2 retries (3 total attempts)
- Exponential backoff: `1000ms * (attempt + 1)`
- Configurable via `maxRetries` option

### API Errors

```typescript
if (!response.ok) {
  const msg = await response.text();
  // Handle HTTP errors (4xx, 5xx)
  return {
    type: "error",
    response: NextResponse.json(
      { error: `Moonshot API error ${response.status}.` },
      { status: 502 }
    )
  };
}
```

### Response Validation Errors

```typescript
try {
  const data = await response.json();
} catch (error) {
  // Invalid JSON response
  return NextResponse.json(
    { error: "Moonshot response was not valid JSON." },
    { status: 502 }
  );
}
```

### Content Extraction Errors

```typescript
const content = extractChoiceText(choice, topic);
if (!content) {
  // Check reasoning as fallback
  const reasoning = choice?.message?.reasoning_content;
  if (reasoning) {
    // Try to extract from reasoning
  } else {
    return NextResponse.json(
      { error: "Moonshot response missing content." },
      { status: 502 }
    );
  }
}
```

---

## Token Usage & Cost Calculation

### Usage Breakdown Type

```typescript
type UsageBreakdown = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  input_cost_usd: number;      // Calculated: prompt_tokens * $0.60 / 1M
  output_cost_usd: number;      // Calculated: completion_tokens * $2.50 / 1M
  total_cost_usd: number;       // Sum of input + output costs
  is_estimated: boolean;        // true if usage was estimated (not from API)
};
```

### Usage Resolution Strategy

1. **Primary**: Use `usage` field from API response (most accurate)
2. **Fallback**: Call `/tokenizers/estimate` endpoint
3. **Last Resort**: Approximate using character count (length / 4)

### Cost Calculation

```typescript
const INPUT_TOKEN_RATE_USD = 0.6 / 1_000_000;   // $0.60 per 1M tokens
const OUTPUT_TOKEN_RATE_USD = 2.5 / 1_000_000;  // $2.50 per 1M tokens

const inputCost = promptTokens * INPUT_TOKEN_RATE_USD;
const outputCost = completionTokens * OUTPUT_TOKEN_RATE_USD;
const totalCost = inputCost + outputCost;
```

**Rounding**: Costs are rounded to 6 decimal places for precision.

---

## Response Parsing

### Extracting Structured Output

The model may return structured data in various formats. Common patterns:

#### 1. Line-Based Output (Concepts)

```typescript
function validateConceptOutput(raw: string): string[] {
  const lines = raw
    .trim()
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => {
      // Filter out reasoning/commentary lines
      return !/^(Let me|I think|I'll|Draft|Reasoning)/i.test(line) &&
             line.length >= 3 && line.length <= 80;
    });
  
  // Extract exactly N concepts (e.g., 3)
  return lines.slice(0, 3);
}
```

#### 2. JSON Extraction

```typescript
function extractJsonObject(raw: string): unknown {
  // Try direct JSON parse first
  try {
    return JSON.parse(raw.trim());
  } catch {
    // Fallback: extract JSON object from text
    // Find first { ... } block
    // Handle escaped strings, nested objects
  }
}
```

#### 3. Reasoning Content Extraction

When main content is empty or truncated, extract from reasoning:

```typescript
function extractHookFromReasoning(reasoning: string): string {
  // Look for quoted strings (50+ chars)
  const quotedMatches = reasoning.matchAll(/"([^"]{50,})"/g);
  
  // Look for draft patterns
  const draftPattern = /(?:Draft|Final script|Hook script):\s*["']([^"']{50,})["']/gi;
  
  // Look for last paragraph with proper punctuation
  const paragraphs = reasoning.split(/\n\s*\n/);
  
  // Return best candidate
}
```

### Content Cleaning

Remove commentary and formatting:

```typescript
function cleanConceptLine(line: string): string {
  // Remove parenthetical explanations
  let cleaned = line.replace(/\([^)]*\)/g, "").trim();
  
  // Remove commentary starters
  const commentaryPatterns = [
    /\s+(Like|Similar to|Just like)\s+/i,
    /\s+(very|extremely|really)\s+(relatable|interesting)/i,
    // ... more patterns
  ];
  
  // Truncate at first commentary pattern
  // Remove trailing punctuation
  return cleaned.replace(/[,.]\s*$/, "").trim();
}
```

---

## Example Implementations

### Example 1: Concept Generation Endpoint

```typescript
export async function POST(request: Request) {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing MOONSHOT_API_KEY environment variable." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const topic = body?.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "Topic is required." }, { status: 400 });
  }

  // Load and hydrate prompt
  const systemPrompt = await readPromptFile("prompts/prompt-1.md");
  const hydratedPrompt = hydratePrompt(systemPrompt, { Topic: topic });

  const payload = {
    model: "kimi-k2-thinking",
    messages: [
      { role: "system", content: hydratedPrompt },
      { role: "system", content: SAFETY_SYSTEM_PROMPT },
      { role: "user", content: topic }
    ],
    temperature: 0.4,
    max_tokens: 1024,
    stream: false
  };

  const result = await callMoonshot(apiKey, payload, { tag: "concepts" });
  if (result.type === "error") {
    return result.response;
  }

  const { data, usage } = result;
  const choice = data?.choices?.[0];
  const content = extractChoiceText(choice, topic);

  if (!content) {
    return NextResponse.json(
      { error: "Moonshot response missing content." },
      { status: 502 }
    );
  }

  // Validate and parse concepts
  const concepts = validateConceptOutput(content);
  return NextResponse.json({ concepts, usage });
}
```

### Example 2: Hook Generation with Reasoning Fallback

```typescript
export async function POST(request: Request) {
  const apiKey = process.env.MOONSHOT_API_KEY;
  const { topic, concepts } = await request.json();

  const hookPrompt = await readPromptFile("prompts/prompt-hook.md");
  const hydratedPrompt = hydratePrompt(hookPrompt, {
    Topic: topic,
    "Key Concepts": concepts.join("\n")
  });

  const payload = {
    model: "kimi-k2-thinking",
    messages: [
      { role: "system", content: hydratedPrompt },
      { role: "user", content: `Topic: ${topic}\nConcepts:\n${concepts.join("\n")}` }
    ],
    temperature: 0.5,
    max_tokens: 4096,
    stream: false
  };

  const result = await callMoonshot(apiKey, payload, {
    tag: "hook",
    timeoutMs: 300000,
    maxRetries: 3
  });

  if (result.type === "error") {
    return result.response;
  }

  const { data } = result;
  const choice = data?.choices?.[0];
  
  // Try main content first
  let hookContent = extractChoiceText(choice, topic, { 
    allowReasoningFallback: false 
  });

  // Check if truncated
  const finishReason = choice?.finish_reason;
  const isTruncated = finishReason === "length" || 
    (hookContent && !hookContent.match(/[.!?]\s*$/));

  // Fallback to reasoning if needed
  if ((!hookContent || isTruncated) && choice?.message?.reasoning_content) {
    const reasoningHook = extractHookFromReasoning(
      choice.message.reasoning_content
    );
    if (reasoningHook && reasoningHook.length > hookContent.length) {
      hookContent = reasoningHook;
    }
  }

  if (!hookContent) {
    return NextResponse.json(
      { error: "Moonshot response missing hook content." },
      { status: 502 }
    );
  }

  return NextResponse.json({ hook: hookContent.trim(), usage: result.usage });
}
```

### Example 3: JSON Quiz Generation

```typescript
const quizPayload = {
  model: "kimi-k2-thinking",
  messages: [
    { role: "system", content: quizPrompt },
    { role: "user", content: `Topic: ${topic}\nConcepts: ${concepts.join(", ")}` }
  ],
  temperature: 0.4,
  max_tokens: 2048,
  stream: false
};

const result = await callMoonshot(apiKey, quizPayload, { tag: "quiz" });
const content = extractChoiceText(result.data?.choices?.[0], topic);

// Extract JSON from response
let quizJson: string;
try {
  quizJson = extractQuizJsonFromReasoning(content);
} catch {
  quizJson = extractJsonObject(content) as string;
}

// Validate quiz structure
const quizzes = validateQuizPayload(JSON.parse(quizJson));
```

---

## Best Practices

### 1. Prompt Engineering

- **Be explicit**: Clearly state output format requirements
- **Use safety prompts**: Add a second system message enforcing format
- **Provide examples**: Show desired output format in prompts
- **Limit reasoning**: For structured outputs, instruct model to output first, reason later

### 2. Error Handling

- Always check for API key before making requests
- Validate input parameters
- Handle missing content gracefully (check reasoning fallback)
- Log errors with context (use `tag` parameter)
- Return meaningful error messages to clients

### 3. Timeout Management

- Use appropriate timeouts based on `max_tokens`
- Longer generations (4096 tokens) need 5-minute timeouts
- Shorter outputs (1024 tokens) can use 2-minute timeouts
- Configure `maxDuration` in Next.js API routes for long-running requests

### 4. Cost Optimization

- Use appropriate `max_tokens` (don't over-allocate)
- Monitor `usage` in responses
- Consider caching for repeated queries
- Use lower `temperature` for structured outputs (saves retries)

### 5. Response Validation

- Always validate structured outputs
- Handle edge cases (empty responses, truncated content)
- Extract from reasoning when main content fails
- Provide fallback values when possible

---

## Type Definitions

### Core Types

```typescript
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

type KimiContentPart = 
  | string
  | {
      type?: string;
      text?: string;
      content?: string;
    };

type UsageBreakdown = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  input_cost_usd: number;
  output_cost_usd: number;
  total_cost_usd: number;
  is_estimated: boolean;
};
```

---

## Constants

```typescript
const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1";
const MODEL_ID = "kimi-k2-thinking";
const INPUT_TOKEN_RATE_USD = 0.6 / 1_000_000;
const OUTPUT_TOKEN_RATE_USD = 2.5 / 1_000_000;
```

---

## Additional Notes

### Reasoning Content

The Kimi K2 model can produce reasoning content separately from the main output. This is useful when:
- Main content is truncated
- You need to understand the model's thinking process
- Extracting structured data from verbose reasoning

Always check `message.reasoning_content` when main content is missing or incomplete.

### Streaming

While the API supports streaming (`stream: true`), the implementation shown uses non-streaming requests for simplicity. Streaming can be added for real-time responses.

### Rate Limiting

The API may have rate limits. Implement exponential backoff and respect rate limit headers if provided.

### Model Updates

The model ID (`kimi-k2-thinking`) may change with updates. Check Moonshot AI documentation for the latest model names.

---

## Summary

This guide covers the essential patterns for integrating with the Kimi K2 Thinking model API:

1. **Authentication**: Bearer token in Authorization header
2. **Request Structure**: Standard chat completions format with model-specific parameters
3. **Response Handling**: Extract content from various response formats, handle reasoning fallback
4. **Error Handling**: Retry logic, timeout management, graceful degradation
5. **Usage Tracking**: Token counting and cost calculation
6. **Response Parsing**: Extract structured outputs, validate formats, clean content

Use the provided functions and patterns as building blocks for your own implementation. Adapt error handling and validation to your specific use case.

