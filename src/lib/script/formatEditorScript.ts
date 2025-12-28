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
    // NOTE: These are intentionally flexible to support both v1 and v2 script prompt phrasing
    // across audiences (Kids + Everyone). They should *not* rely on explicit section headers,
    // since prompts instruct the model to output continuous narration text.
    {
      // v1: "So what is [Topic]?"
      // v2 (Kids): "So, what actually is [Topic]?"
      // v2 (Everyone): "To understand this... What actually is [Topic]?"
      pattern:
        /\bat its core\b|\bso,?\s*what\s+(?:actually\s+|exactly\s+)?is\b|\bto understand this, we first have to ask:\s*what\s+(?:actually|exactly)\s+is\b|\bwhat\s+(?:actually|exactly)\s+is\b/i,
      title: "2. Definition & Basics",
    },
    {
      // v1: "Time for our first quiz..."
      // v2 (Kids): "Okay, pop quiz time!"
      // v2 (Everyone): "Let’s pause for a second..."
      pattern:
        /\bfirst quiz\b|\bpop quiz\b|\bknowledge check\b|let['’]?s pause for a (?:second|moment)\b|pause for a (?:quick check|second)\b|based on that, how would you handle this\b/i,
      title: "3. Quiz 1",
    },
    {
      // v1: "Here comes our second quiz..."
      // v2 (Kids): "Round two!"
      // v2 (Everyone): "Here is a scenario that trips..."
      pattern:
        /\bsecond quiz\b|\bround two\b|here(?:'s| is) a scenario\b|scenario that trips\b|\banother test\b/i,
      title: "4. Quiz 2",
    },
    {
      // v1: "Final quiz time!"
      // v2 (Kids): "Final round. The Boss Level question!"
      // v2 (Everyone): "One final question..."
      pattern:
        /\bfinal quiz\b|\bfinal round\b|\bboss level\b|\bone final question\b|\bfinal question\b/i,
      title: "5. Final Quiz",
    },
    {
      // v1: "Today we learned..."
      // v2 (Kids): "So, let's recap..."
      // v2 (Everyone): "So, [Topic] isn't just..."
      // NOTE: keep this relatively specific to avoid accidentally matching early "wasn't just" phrases.
      pattern:
        /\btoday we learned\b|let['’]?s recap\b|\bto recap\b|\bin summary\b|\bto sum up\b|^so,\s+.*\b(?:isn['’]?t|aren['’]?t|is not|are not)\s+just\b/i,
      title: "6. Recap",
    },
    {
      pattern:
        /\bnext time you\b|\bthanks for learning\b|\bthanks for watching\b|\bsee you next time\b/i,
      title: "7. Closing",
    },
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
