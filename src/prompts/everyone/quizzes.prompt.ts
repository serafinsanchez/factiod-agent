export const QUIZZES_PROMPT_TEMPLATE = `I'm creating a YouTube video that teaches in a fun, engaging, and family-friendly way. The audience is teens to adults, with all content suitable for children. The video includes two quiz pauses to enhance engagement.

Here is my video topic:
[Topic]
Here are the key concepts:
[KeyConcepts]

Here is the script for the video hook:
[HookScript]

Task:
Generate three quiz questions, each on a different key concept. For each quiz, write either a four-option multiple-choice or a true/false question. Questions should be clear and suitable for a broad audience.

- True/false: include TRUE and FALSE as options.
- Multiple-choice: provide four options, one correct answer.

Internally assess questions for educational value and engagement; do not output this.

Output only the quiz questions and answers, no extra text. Use this format:

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
