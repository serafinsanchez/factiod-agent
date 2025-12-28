/**
 * Centralized script prompt variant selection.
 * Provides v1 (original) and v2 (retention-optimized) script templates
 * for both Kids and Everyone audiences.
 */
import type { AudienceMode } from "@/types/agent";

// Kids audience script prompts
import { SCRIPT_PROMPT_TEMPLATE as KIDS_V1 } from "./script.prompt";
import { SCRIPT_PROMPT_TEMPLATE as KIDS_V2 } from "./script-v2.prompt";

// Everyone audience script prompts
import { SCRIPT_PROMPT_TEMPLATE as EVERYONE_V1 } from "./everyone/script.prompt";
import { SCRIPT_PROMPT_TEMPLATE as EVERYONE_V2 } from "./everyone/script-v2.prompt";

/**
 * Script prompt version identifier.
 * - v1: Original prompt (default)
 * - v2: Retention-optimized prompt for A/B testing
 */
export type ScriptPromptVersion = "v1" | "v2";

/**
 * Default script prompt version.
 */
export const DEFAULT_SCRIPT_PROMPT_VERSION: ScriptPromptVersion = "v1";

/**
 * Get the script prompt template for the given audience and version.
 */
export function getScriptPromptTemplate(
  audienceMode: AudienceMode,
  version: ScriptPromptVersion = DEFAULT_SCRIPT_PROMPT_VERSION
): string {
  if (audienceMode === "forEveryone") {
    return version === "v2" ? EVERYONE_V2 : EVERYONE_V1;
  }
  // forKids (default)
  return version === "v2" ? KIDS_V2 : KIDS_V1;
}

/**
 * Human-readable labels for script prompt versions.
 */
export const SCRIPT_PROMPT_VERSION_LABELS: Record<ScriptPromptVersion, string> = {
  v1: "v1 (Original)",
  v2: "v2 (Retention-Optimized)",
};
