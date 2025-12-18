/**
 * Utility to format a raw video script into a sectioned Markdown document for editors.
 * It adds headings based on common markers without changing any spoken words.
 */

interface Section {
  title: string;
  paragraphs: string[];
}

export function buildEditorScript(topic: string, videoScript: string): string {
  if (!videoScript) return "";

  const paragraphs = videoScript
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sections: Section[] = [];
  let currentSection: Section = { title: "1. Introduction & Hook", paragraphs: [] };

  const anchorPatterns = [
    { pattern: /so what is/i, title: "2. Definition & Basics" },
    { pattern: /first quiz/i, title: "3. Quiz 1" },
    { pattern: /second quiz/i, title: "4. Quiz 2" },
    { pattern: /final quiz/i, title: "5. Final Quiz" },
    { pattern: /today we learned/i, title: "6. Recap" },
    { pattern: /next time you|thanks for learning/i, title: "7. Closing" },
  ];

  // We want to track which anchors we've already used to avoid jumping back
  let nextAnchorIndex = 0;

  for (const p of paragraphs) {
    let matchedNewSection = false;

    // Check if this paragraph contains the next expected anchor
    // We look ahead to see if it matches any anchor we haven't hit yet
    for (let i = nextAnchorIndex; i < anchorPatterns.length; i++) {
      if (anchorPatterns[i].pattern.test(p)) {
        // If we found a match, start a new section
        if (currentSection.paragraphs.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { title: anchorPatterns[i].title, paragraphs: [p] };
        nextAnchorIndex = i + 1;
        matchedNewSection = true;
        break;
      }
    }

    if (!matchedNewSection) {
      currentSection.paragraphs.push(p);
    }
  }

  // Push the last section
  if (currentSection.paragraphs.length > 0) {
    sections.push(currentSection);
  }

  // Build the final markdown
  return sections
    .map((s) => `### ${s.title}\n\n${s.paragraphs.join("\n\n")}`)
    .join("\n\n");
}
