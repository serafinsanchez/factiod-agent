/**
 * Interpolates template variables in the form [VarName] with values from vars.
 *
 * IMPORTANT: Only substitutes when the key *exists* in vars. Unknown bracket
 * tokens are preserved as-is. This allows prompt templates to include literal
 * bracket examples (e.g., "[Option A answer]", "[tag]", "[correct answer]")
 * without having them blanked out.
 *
 * @example
 * interpolatePrompt("Topic: [Topic], Format: [Option A answer]", { Topic: "Volcanoes" })
 * // => "Topic: Volcanoes, Format: [Option A answer]"
 */
export function interpolatePrompt(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\[([^\]]+)\]/g, (match, key: string) => {
    // Only substitute if the key actually exists in vars.
    // This preserves literal bracket examples like [tag], [Option A answer], etc.
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? '';
    }
    // Key not found in vars — leave the original bracket token intact.
    return match;
  });
}


