import { describe, expect, it } from "vitest";

import { buildEditorScript } from "./formatEditorScript";

describe("buildEditorScript", () => {
  it("adds all 7 editor headings for For Everyone v2-style phrasing", () => {
    const topic = "How microscopes work";
    const videoScript = [
      "Have you ever wondered how a tiny drop of pond water can reveal an entire hidden universe?",
      "At its core, a microscope is an optical instrument that uses light and lenses to reveal details too small for your eyes to resolve.",
      "Now let's follow the light path through the microscope.",
      "Let's pause for a quick check. In a microscope, what is the correct path that light travels? Option A: ... Option B: ...",
      "The correct answer is B. Here's why.",
      "Here's another test. If a microscope has a 10x eyepiece and a 40x objective, what is the total magnification? Option A: ...",
      "One final question to see if you've mastered this. Resolution and magnification are the same thing. TRUE or FALSE?",
      "So, microscopes aren't just fancy magnifying glasses — they're actually machines for increasing resolution.",
      "Next time you see a microscope, trace the light path in your mind: illuminator, specimen, objective, eyepiece, eye.",
    ].join("\n\n");

    const result = buildEditorScript(topic, videoScript);

    // The core regression: previously only Intro + Closing showed up for v2 scripts.
    expect(result).toContain("### 1. Introduction & Hook");
    expect(result).toContain("### 2. Definition & Basics");
    expect(result).toContain("### 3. Quiz 1");
    expect(result).toContain("### 4. Quiz 2");
    expect(result).toContain("### 5. Final Quiz");
    expect(result).toContain("### 6. Recap");
    expect(result).toContain("### 7. Closing");
  });
});

