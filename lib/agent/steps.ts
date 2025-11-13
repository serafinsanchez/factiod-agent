import { StepConfig, StepId } from '../../types/agent';

export const STEP_CONFIGS: StepConfig[] = [
  {
    id: 'keyConcepts',
    label: 'Prompt 1 – Key Concepts',
    defaultModel: 'gpt5-thinking',
    inputVars: ['Topic'],
    outputVars: ['KeyConcepts'],
    promptTemplate: `You are an expert at scripting educational kids videos. You have great pedagogical skills and you know how to make things engaging for elementary aged kids. Today you are preparing an outline on a new video. Here is the video topic. 
— [Topic] —
The video will be about 10 minutes long. Which key concepts should we cover during that time? Silently many possible concepts for their pedagogical importance and their interest to children. Pick the topics that are most interesting to kids (heavier weighted) and have some pedagogical importance. The kids are age 5 to 9. Narrow it to 3 key concepts and output those. Do not output anything besides the topic of the three key concepts.`,
  },
  {
    id: 'hook',
    label: 'Prompt 2 – Hook',
    defaultModel: 'gpt5-thinking',
    inputVars: ['Topic', 'KeyConcepts'],
    outputVars: ['HookScript'],
    promptTemplate: `Video Topic: [Topic]
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

Output only the final spoken hook script.`,
  },
  {
    id: 'quizzes',
    label: 'Prompt 3 – Quiz Generation',
    defaultModel: 'gpt5-thinking',
    inputVars: ['Topic', 'KeyConcepts', 'HookScript'],
    outputVars: ['QuizInfo'],
    promptTemplate: `I’m preparing a youtube video that teaches kids in a fun and engaging way. The kids are aged 5 to 9 and in elementary school. I want my video to have pauses for two quizzes. 

Here is my video topic
— [Topic] —
Here are the key concepts in the video
— [KeyConcepts] —

Here is the script for the video hook 
— [HookScript] —

Please write two questions and their answers for me. Each quiz should have one four option multiple-choice or a true-or-false question. Regardless of type, it must be easy to follow for elementary kids.

True/false: one TRUE option and one FALSE option.  
Multiple choice: 4 options, one correct.

Silently think about your choices and evaluate them for pedagogical importance and child engagement. Output only the quiz questions and answers.`,
  },
  {
    id: 'script',
    label: 'Prompt 4 – Script Generation',
    defaultModel: 'gpt5-thinking',
    inputVars: ['Topic', 'KeyConcepts', 'HookScript', 'QuizInfo'],
    outputVars: ['VideoScript'],
    promptTemplate: `You are an expert at scripting educational kids videos. You have great pedagogical skills and you know how to make things engaging for elementary aged kids. I already wrote the video topic, key concepts, and the hook for the video. I also wrote two quiz questions that I want to interject in the video. We will pause the video and ask the quiz questions. That way we know the kid is engaged to the video instead of just watching like a zombie. 

You are going to write a video script for me that uses best practices for engaging kids videos. It’s important that this video matches pedagogical standards but it’s even more important that it’s fun and engaging for kids. Video length should be 10 minutes so lets make it about at least 1600 words. Silently review the script for kid engagement and ease of narration before finalizing the script. 

The script that you write will be written verbatim by a narrator. Include lots of punctuation to help the narrator read your script. Output only an engaging kids script and nothing else. My channel is called PIP academy and you can reference that name. 

Here is my video topic
— [Topic] —
Here are the key concepts in the video
— [KeyConcepts] —

Here is the script for the video hook 
— [HookScript] —
Here are the quiz questions and answers
— [QuizInfo] —

Include the hook at the top of the script when you output the script. Don’t do any cheesy greetings.`,
  },
  {
    id: 'titleDescription',
    label: 'Prompt 5 – Title & Description',
    defaultModel: 'gpt5-thinking',
    inputVars: ['Topic', 'KeyConcepts', 'HookScript', 'QuizInfo'],
    outputVars: ['Title', 'Description'],
    promptTemplate: `You are an expert youtube marketer. I have a kids youtube channel called PIP academy. We teach lots of topics to elementary aged kids 5 to 9. I want you to make a title that is catchy and works well for youtube SEO. I am a premium kids content maker so you must consider my brand over everything else. No clickbait phrases: avoid “you won’t believe,” “craziest,” “insane,” “mind-blowing,” “secret” etc.

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
Title on its own line, blank line, then description.`,
  },
  {
    id: 'thumbnail',
    label: 'Prompt 6 – Thumbnail Prompt',
    defaultModel: 'gpt5-thinking',
    inputVars: ['Topic', 'KeyConcepts'],
    outputVars: ['ThumbnailPrompt'],
    promptTemplate: `You are an expert youtube marketer. My Youtube channel teaches elementary aged kids aged 5 to 9. I need to generate a video thumbnail that is 16:9. I need something that will spark curiosity for a child. My best performing videos feature a photoreal image of a kid's face doing something in the video, but it’s not totally required.

Review my video details and think about how to drive maximum clicks from elementary-aged kids. Then give me a text prompt for Midjourney to generate the thumbnail. Output only the prompt.

Here is my video topic
— [Topic] —
Here are the key concepts
— [KeyConcepts] —`,
  },
];

const STEP_CONFIG_MAP: Record<StepId, StepConfig> = STEP_CONFIGS.reduce(
  (acc, config) => {
    acc[config.id] = config;
    return acc;
  },
  {} as Record<StepId, StepConfig>,
);

export function getStepConfig(stepId: StepId): StepConfig {
  const config = STEP_CONFIG_MAP[stepId];
  if (!config) {
    throw new Error(`Unknown step: ${stepId}`);
  }
  return config;
}

