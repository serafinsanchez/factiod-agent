import { describe, expect, it } from "vitest";

import { ensureChecklistWordCount } from "./checklist";

describe("ensureChecklistWordCount", () => {
  it("replaces the reported count when the line already contains Final word count", () => {
    const checklist = [
      "Checklist:",
      "LENGTH: ✅ Final word count: 1,487 words. Trimmed extra chatter.",
      "FACTS: ✅ Verified all astronomy facts.",
    ].join("\n");

    const result = ensureChecklistWordCount(checklist, 1520);

    expect(result).toContain("Final word count: 1,520 words.");
    expect(result).not.toContain("1,487");
  });

  it("inserts the count when the line lacks the phrase", () => {
    const checklist = [
      "Checklist:",
      "LENGTH: ✅ Trimmed filler sentences.",
      "FACTS: ✅ Verified all astronomy facts.",
    ].join("\n");

    const result = ensureChecklistWordCount(checklist, 1490);

    expect(result).toContain("LENGTH: ✅ Final word count: 1,490 words. Trimmed filler sentences.");
  });

  it("adds a new LENGTH line when missing entirely", () => {
    const checklist = ["Checklist:", "FACTS: ✅ All good."].join("\n");

    const result = ensureChecklistWordCount(checklist, 1500);

    expect(result.split("\n")[0]).toBe("LENGTH: Final word count: 1,500 words.");
  });
});

