export const QUIZZES_PROMPT_TEMPLATE = `I’m preparing a youtube video that teaches kids in a fun and engaging way. The kids are aged 5 to 9 and in elementary school. I want my video to have pauses for two quizzes. 

Here is my video topic
— [Topic] —
Here are the key concepts in the video
— [KeyConcepts] —

Here is the script for the video hook 
— [HookScript] —

Please write three questions and their answers for me. Each quiz should have one four option multiple-choice or a true-or-false question. Regardless of type, it must be easy to follow for elementary kids.

True/false: one TRUE option and one FALSE option.  
Multiple choice: 4 options, one correct.

Silently think about your choices and evaluate them for pedagogical importance and child engagement. Output only the quiz questions and answers. Use this format:

Question 1: [Your question text]
Options:
A) [Option A answer]
B) [Option B answer]
C) [Option C answer]
D) [Option D answer] (if multiple choice)
Correct Answer: [Correct option letter]

OR for true/false:
Question 1: [Your question text]
Options:
A) TRUE
B) FALSE
Correct Answer: [Correct option letter]

Provide all three questions and answers in this format only.`;
