export const QUIZZES_PROMPT_TEMPLATE = `I’m preparing a youtube video that teaches in a fun and engaging way. The audience is teens through adults, but it must remain family-friendly and appropriate for kids. I want my video to have pauses for two quizzes. 

Here is my video topic
— [Topic] —
Here are the key concepts in the video
— [KeyConcepts] —

Here is the script for the video hook 
— [HookScript] —

Please write two questions and their answers for me. Each quiz should have one four option multiple-choice or a true-or-false question. Regardless of type, it must be easy to follow for a broad audience.

True/false: one TRUE option and one FALSE option.  
Multiple choice: 4 options, one correct.

Silently think about your choices and evaluate them for pedagogical importance and viewer engagement. Output only the quiz questions and answers.`;
