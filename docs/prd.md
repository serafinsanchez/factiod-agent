Below is a clean, self-contained **Markdown reference document** you can hand directly to Cursor.
It includes: architecture, data flow, APIs, types, UI structure, and implementation notes — but no meta commentary.

---

# **Agentic 6-Step Kids Video Builder – System Reference (for Cursor)**

This document defines the architecture, data flow, prompt templates, variables, UI behavior, and backend endpoints for a Next.js app that runs a 6-step LLM pipeline with editable prompts, manual/auto execution, and token/cost tracking.

---

# **1. Overview**

This application builds a complete YouTube kids-education video pipeline using 6 sequential LLM prompts.
Features:

* Edit each prompt template
* Run each step manually
* Run all 6 steps in automatic sequence
* View the resolved prompt, output, tokens, and cost per step
* See total tokens + cost across all steps
* Select model: **gpt-5.1-2025-11-13** (legacy alias `gpt5-thinking`) or **kimik2-thinking**
* Each step passes outputs to downstream steps as variables

---

# **2. Data Flow (DAG Overview)**

Variables flow through 6 ordered steps:

1. **Prompt 1 — Key Concepts**
   Input: `Topic`
   Output: `keyConcepts`

2. **Prompt 2 — Hook**
   Input: `Topic`, `keyConcepts`
   Output: `hookScript`

3. **Prompt 3 — Quiz Generation**
   Input: `Topic`, `keyConcepts`, `hookScript`
   Output: `quizInfo`

4. **Prompt 4 — Full Script**
   Input: `Topic`, `keyConcepts`, `hookScript`, `quizInfo`
   Output: `videoScript`

5. **Prompt 5 — Title & Description**
   Input: `Topic`, `keyConcepts`, `hookScript`, `quizInfo`
   Output: `title`, `description`

6. **Prompt 6 — Thumbnail Prompt**
   Input: `Topic`, `keyConcepts`
   Output: `thumbnailPrompt`

---

# **3. Prompt Templates (canonical originals)**

### **Prompt 1 — Key Concepts**

```
You are an expert at scripting educational kids videos. You have great pedagogical skills and you know how to make things engaging for elementary aged kids. Today you are preparing an outline on a new video. Here is the video topic. 
— [Topic] —
The video will be about 10 minutes long. Which key concepts should we cover during that time? Silently many possible concepts for their pedagogical importance and their interest to children. Pick the topics that are most interesting to kids (heavier weighted) and have some pedagogical importance. The kids are age 5 to 9. Narrow it to 3 key concepts and output those. Do not output anything besides the topic of the three key concepts.
```

---

### **Prompt 2 — Hook**

```
Video Topic: [Topic]
Key Concepts: [KeyConcepts]

Task
Write one polished YouTube opening hook for the topic above.
Length: 20–30 seconds spoken.
Audience: Elementary-aged kids (6–9) and ESL editors—keep English simple and clear (Grade 2–3 level).
You may think through options silently, but show only the final script.

Structure (use this flow)
The Grab — a surprising fact, a “Have you ever wondered…?” question, or a funny/relatable analogy.

The Adventure — in 2–3 short sentences, preview what we’ll explore or do (mini-outline).

The Promise — what the viewer will know or be able to do by the end.

Style Rules
Short sentences. Concrete, kid-friendly words. Speak to the viewer as “you” or “we.”
Be vivid, visual, and positive.
If a real term is needed, introduce it gently (“we call that…”) after a simple explanation.

Anti-Spam & Brand-Safety Guardrails (strict)
No clickbait phrases: avoid “you won’t believe,” “craziest,” “insane,” “mind-blowing,” “secret” etc.
No unrealistic promises or magic claims; stay accurate to the outline.
No calls to action like “like/subscribe,” no FOMO (“watch to the end or else”).
No shouty punctuation (max one exclamation if any), no ALL CAPS.
Emojis: avoid by default; if tone is “silly,” use at most one tasteful emoji.
Safety first: if demonstrating something hands-on, mention simple safety or adult help when needed.
The hook must match the outline—no bait-and-switch.

Process (silent—do not show)
Brainstorm 3 variants (surprise / question / analogy).
Rate each for Curiosity, Clarity, Energy.
Choose the best and polish.

Output only the final spoken hook script.
```

---

### **Prompt 3 — Quiz Generation**

```
I’m preparing a youtube video that teaches kids in a fun and engaging way. The kids are aged 5 to 9 and in elementary school. I want my video to have pauses for two quizzes. 

Here is my video topic
— [Topic] —
Here are the key concepts in the video
— [KeyConcepts] —

Here is the script for the video hook 
— [HookScript] —

Please write two questions and their answers for me. Each quiz should have one four option multiple-choice or a true-or-false question. Regardless of type, it must be easy to follow for elementary kids.

True/false: one TRUE option and one FALSE option.  
Multiple choice: 4 options, one correct.

Silently think about your choices and evaluate them for pedagogical importance and child engagement. Output only the quiz questions and answers.
```

---

### **Prompt 4 — Script Generation**

```
You are an expert at scripting educational kids videos. You have great pedagogical skills and you know how to make things engaging for elementary aged kids. I already wrote the video topic, key concepts, and the hook for the video. I also wrote two quiz questions that I want to interject in the video. We will pause the video and ask the quiz questions. That way we know the kid is engaged to the video instead of just watching like a zombie. 

You are going to write a video script for me that uses best practices for engaging kids videos. It’s important that this video matches pedagogical standards but it’s even more important that it’s fun and engaging for kids. Video length should be 10 minutes so lets make it about at max 1600 words. Silently review the script for kid engagement and ease of narration before finalizing the script. 

The script that you write will be written verbatim by a narrator. Include lots of punctuation to help the narrator read your script. Output only an engaging kids script and nothing else. My channel is called PIP academy and you can reference that name. 

Here is my video topic
— [Topic] —
Here are the key concepts in the video
— [KeyConcepts] —

Here is the script for the video hook 
— [HookScript] —
Here are the quiz questions and answers
— [QuizInfo] —

Include the hook at the top of the script when you output the script. Don’t do any cheesy greetings.
```

---

### **Prompt 5 — Video Title & Description**

```
You are an expert youtube marketer. I have a kids youtube channel called PIP academy. We teach lots of topics to elementary aged kids 5 to 9. I want you to make a title that is catchy and works well for youtube SEO. I am a premium kids content maker so you must consider my brand over everything else. No clickbait phrases: avoid “you won’t believe,” “craziest,” “insane,” “mind-blowing,” “secret” etc.

Here is my video topic
— [Topic] —
Here are the key concepts in the video
— [KeyConcepts] —

Here is the script for the video hook 
— [HookScript] —
Here are the quiz questions and answers
— [QuizInfo] —

First write an amazing youtube title. Then write the description. Keep it concise and include a promo at the end to Goally (getgoally.com). Include the URL.

Output format:
Title on its own line, blank line, then description.
```

---

### **Prompt 6 — Thumbnail Prompt**

```
You are an expert youtube marketer. My Youtube channel teaches elementary aged kids aged 5 to 9. I need to generate a video thumbnail that is 16:9. I need something that will spark curiosity for a child. My best performing videos feature a photoreal image of a kid's face doing something in the video, but it’s not totally required.

Review my video details and think about how to drive maximum clicks from elementary-aged kids. Then give me a text prompt for Midjourney to generate the thumbnail. Output only the prompt.

Here is my video topic
— [Topic] —
Here are the key concepts
— [KeyConcepts] —
```

> **Cost:** Gemini 3 Pro (1K-4K) image renders typically consume 1,210-2,000 tokens. At $20 per 1M image tokens, expect roughly $0.024-$0.040 per thumbnail generation.

---

# **4. Type System**

```ts
export type ModelId = 'gpt-5.1-2025-11-13' | 'kimik2-thinking';

export type StepId =
  | 'keyConcepts'
  | 'hook'
  | 'quizzes'
  | 'script'
  | 'titleDescription'
  | 'thumbnail';

export interface StepConfig {
  id: StepId;
  label: string;
  defaultModel: ModelId;
  promptTemplate: string;
  inputVars: string[];
  outputVars: string[];
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
```

---

# **5. LLM Client Abstraction**

### `callModel(model, prompt)`

* Maps model IDs to actual deployed model names
* Returns `{ text, usage }`
* `usage` includes the token breakdown

Example:

```ts
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function callModel(model: ModelId, prompt: string) {
  const modelName =
    model === 'gpt-5.1-2025-11-13'
      ? 'gpt-5.1-2025-11-13'
      : 'kimi-k2-thinking';

  const result = await client.chat.completions.create({
    model: modelName,
    messages: [{ role: 'user', content: prompt }],
  });

  const choice = result.choices[0];
  return {
    text: choice.message?.content ?? '',
    usage: result.usage
  };
}
```

---

# **6. Cost Calculation**

```ts
const PRICES: Record<ModelId, { input: number; output: number }> = {
  'gpt-5.1-2025-11-13': { input: 0.0xx, output: 0.0xx },
  'kimik2-thinking': { input: 0.0yy, output: 0.0yy },
};

export function estimateCost(model: ModelId, promptTokens: number, completionTokens: number) {
  const p = PRICES[model];
  return (
    (promptTokens * p.input + completionTokens * p.output) / 1_000_000
  );
}
```

Thumbnail image generation uses Gemini 3 Pro (1K-4K) outside this token ledger. Each render typically consumes 1,210-2,000 image tokens at $20 per 1M, so allocate an additional ~$0.024-$0.040 per thumbnail.

---

# **7. Backend API**

## **POST `/api/agent/run-step`**

### **Request**

```json
{
  "stepId": "hook",
  "model": "gpt-5.1-2025-11-13",
  "topic": "How volcanoes work",
  "variables": {
    "KeyConcepts": "...",
    "HookScript": "..."
  },
  "promptTemplateOverride": "optional edited template"
}
```

### **Response**

```json
{
  "responseText": "LLM output",
  "metrics": {
    "inputTokens": 123,
    "outputTokens": 456,
    "totalTokens": 579,
    "costUsd": 0.00023
  },
  "producedVariables": {
    "hookScript": "..."
  }
}
```

---

## **POST `/api/agent/run-all`**

* Runs all 6 prompts in order using the same model.
* Supports user-edited templates.
* Returns the full updated `PipelineState`.

---

# **8. Running Steps (Backend Logic)**

### Running a single step:

1. Select template → apply `promptTemplateOverride` if provided
2. Interpolate variables:

   * Replace `[Topic]`, `[KeyConcepts]`, etc.
3. Call LLM
4. Compute metrics
5. Return output + updated variables

---

# **9. UI Specification (Next.js)**

The main page should include:

### **Global Controls**

* Topic input
* Model selector (radio dropdown):

* gpt-5.1-2025-11-13
  * kimik2-thinking
* “Run all steps (Auto)” button
* Total tokens + cost summary

---

## **Step Cards (6 total)**

Each card shows:

### **1. Title**

`Prompt 1 – Key Concepts`, etc.

### **2. Editable prompt template**

`<textarea>` with reset-to-default button.

### **3. Variable preview**

Resolved values for:

* Topic
* Key Concepts
* Hook
* Quiz Info
* etc.

### **4. Run Controls**

* Run this step
* Shows loading state while calling backend

### **5. Output Panel**

* Rendered LLM output (monospace box)

### **6. Metrics**

* Input tokens
* Output tokens
* Total tokens
* Step cost

---

# **10. Total Metrics**

Compute:

```ts
pipeline.totalTokens = sum(step.metrics.totalTokens)
pipeline.totalCostUsd = sum(step.metrics.costUsd)
```

Display at bottom or top.

---

# **11. Parsing Rules for Outputs**

* **Prompt 1:** Entire output → `keyConcepts`
* **Prompt 2:** Entire output → `hookScript`
* **Prompt 3:** Entire output → `quizInfo`
* **Prompt 4:** Entire output → `videoScript`
* **Prompt 5:**

  * First line → `title`
  * Remainder → `description`
* **Prompt 6:** Entire output → `thumbnailPrompt`

No inner parsing required unless user adds advanced features later.

---

# **12. Future Extensions (Optional)**

* History of runs
* Branching pipelines
* Retry logic per step
* JSON-schema outputs
* Evaluation + auto-rerun

---

# **End of Document**

This file can now be placed into your Cursor project as a reference spec.
