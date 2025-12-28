/**
 * Timestamp Alignment Utilities
 * 
 * Aligns production script scenes with actual narration audio timestamps.
 * Uses fuzzy text matching to find where each scene's narration appears
 * in the transcribed audio and populates precise startSec/endSec values.
 * 
 * Constraints:
 * - WAN 2.2 video model has a HARD MAX of 10 seconds per clip
 * - Scenes exceeding 10 seconds are automatically split at natural boundaries
 * - Minimum scene duration is 3 seconds to avoid jarring cuts
 */

import type {
  NarrationTimestampsData,
  ProductionScene,
  ProductionScriptData,
} from "@/types/agent";

/** WAN 2.2 model constraints */
const MAX_SCENE_DURATION_SEC = 10;
const MIN_SCENE_DURATION_SEC = 3;
const TARGET_SCENE_DURATION_SEC = 7; // Sweet spot for video generation

/**
 * Result of aligning a single scene to audio timestamps
 */
interface SceneAlignmentResult {
  sceneNumber: number;
  startSec: number;
  endSec: number;
  confidence: number; // 0-1, how confident we are in the match
  method: "fuzzy-match" | "sequential" | "estimated" | "split";
  wasSplit?: boolean; // True if this scene was split from a longer scene
  originalSceneNumber?: number; // Original scene number if split
}

/**
 * Normalize text for comparison (lowercase, remove punctuation, collapse whitespace)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find the timestamp range for a given text snippet within the narration.
 * Uses fuzzy matching to handle minor transcription differences.
 * 
 * @param text - The narration text to find
 * @param timestamps - The full narration timestamps from Whisper
 * @param minStartSec - Minimum start time (to enforce chronological order)
 * @returns Start and end times with confidence score, or null if not found
 */
export function findTimestampRangeForText(
  text: string,
  timestamps: NarrationTimestampsData,
  minStartSec: number = 0
): { start: number; end: number; confidence: number } | null {
  if (!timestamps.words.length) {
    return null;
  }

  // Normalize the search text
  const normalizedSearch = normalizeText(text);
  const searchWords = normalizedSearch.split(/\s+/).filter(Boolean);

  if (searchWords.length === 0) {
    return null;
  }

  // Build normalized transcript words array
  const transcriptWords = timestamps.words.map((w) => ({
    normalized: normalizeText(w.word),
    original: w,
  }));

  // Find the starting word index that's at or after minStartSec
  let startSearchIdx = 0;
  if (minStartSec > 0) {
    for (let i = 0; i < transcriptWords.length; i++) {
      if (transcriptWords[i].original.start >= minStartSec - 0.5) { // Allow 0.5s overlap tolerance
        startSearchIdx = i;
        break;
      }
    }
  }

  // Sliding window search for the best match (only after minStartSec)
  let bestMatch: { start: number; end: number; score: number; startIdx: number; endIdx: number } | null = null;

  for (let i = startSearchIdx; i <= transcriptWords.length - Math.min(searchWords.length, transcriptWords.length); i++) {
    let matchCount = 0;
    let j = 0; // index in search words
    let k = i; // index in transcript words

    // Try to match words allowing for some flexibility (Whisper may split/join words differently)
    while (j < searchWords.length && k < transcriptWords.length) {
      const searchWord = searchWords[j];
      const transcriptWord = transcriptWords[k].normalized;

      // Check for match (partial match allowed for compound words)
      if (
        transcriptWord === searchWord ||
        transcriptWord.includes(searchWord) ||
        searchWord.includes(transcriptWord)
      ) {
        matchCount++;
        j++;
      }
      k++;

      // Don't search too far ahead (allow 2x window for flexibility)
      if (k - i > searchWords.length * 2) {
        break;
      }
    }

    const score = matchCount / searchWords.length;

    // Require at least 50% match to consider it valid
    if (score >= 0.5 && (!bestMatch || score > bestMatch.score)) {
      const endIndex = Math.min(k - 1, transcriptWords.length - 1);
      bestMatch = {
        start: transcriptWords[i].original.start,
        end: transcriptWords[endIndex].original.end,
        score,
        startIdx: i,
        endIdx: endIndex,
      };
    }
  }

  if (bestMatch) {
    return {
      start: bestMatch.start,
      end: bestMatch.end,
      confidence: bestMatch.score,
    };
  }

  return null;
}

/**
 * Find natural split points within a scene based on Whisper segments.
 * Prefers sentence boundaries and natural pauses.
 */
function findNaturalSplitPoint(
  startSec: number,
  endSec: number,
  timestamps: NarrationTimestampsData
): number | null {
  const duration = endSec - startSec;
  if (duration <= MAX_SCENE_DURATION_SEC) {
    return null; // No split needed
  }

  // Look for Whisper segment boundaries within the scene
  // that are close to the target duration
  const targetSplitPoint = startSec + TARGET_SCENE_DURATION_SEC;
  
  // Find segments that end within our scene
  const candidateSplitPoints: number[] = [];
  
  for (const segment of timestamps.segments) {
    const segEnd = segment.end;
    // Segment end must be within our scene and create valid sub-scenes
    if (
      segEnd > startSec + MIN_SCENE_DURATION_SEC &&
      segEnd < endSec - MIN_SCENE_DURATION_SEC &&
      segEnd <= startSec + MAX_SCENE_DURATION_SEC
    ) {
      candidateSplitPoints.push(segEnd);
    }
  }

  // If we found segment boundaries, pick the one closest to target
  if (candidateSplitPoints.length > 0) {
    return candidateSplitPoints.reduce((best, point) => 
      Math.abs(point - targetSplitPoint) < Math.abs(best - targetSplitPoint) ? point : best
    );
  }

  // Fallback: look for word gaps (pauses) in the audio
  // Find words with larger gaps before them
  const wordsInRange = timestamps.words.filter(
    (w) => w.start >= startSec + MIN_SCENE_DURATION_SEC && 
           w.start <= startSec + MAX_SCENE_DURATION_SEC
  );

  let bestGapPoint: number | null = null;
  let bestGap = 0;

  for (let i = 1; i < wordsInRange.length; i++) {
    const gap = wordsInRange[i].start - wordsInRange[i - 1].end;
    if (gap > bestGap && gap > 0.1) { // Look for pauses > 100ms
      bestGap = gap;
      bestGapPoint = wordsInRange[i - 1].end;
    }
  }

  if (bestGapPoint) {
    return bestGapPoint;
  }

  // Last resort: split at target point
  return targetSplitPoint;
}

/**
 * Align all scenes in a production script to actual audio timestamps.
 * 
 * Strategy:
 * 1. Try fuzzy matching each scene's narrationText to the audio
 * 2. For scenes that can't be matched, use sequential positioning based on previous scene
 * 3. Fall back to estimated timing based on word count if all else fails
 * 4. CRITICAL: Enforce 10-second max duration (WAN 2.2 limit) by splitting long scenes
 * 
 * @param productionScript - The production script with scenes to align
 * @param timestamps - Word-level timestamps from Whisper transcription
 * @returns Updated production script with accurate startSec/endSec values
 */
export function alignScenesToTimestamps(
  productionScript: ProductionScriptData,
  timestamps: NarrationTimestampsData
): { alignedScript: ProductionScriptData; alignmentResults: SceneAlignmentResult[] } {
  const alignmentResults: SceneAlignmentResult[] = [];
  const alignedScenes: ProductionScene[] = [];

  let lastEndSec = 0;
  const totalDuration = timestamps.totalDurationSec;

  for (const scene of productionScript.scenes) {
    // Try fuzzy matching first, starting from where the previous scene ended
    // This ensures scenes are found in chronological order
    const matchResult = findTimestampRangeForText(scene.narrationText, timestamps, lastEndSec);

    let startSec: number;
    let endSec: number;
    let confidence: number;
    let method: SceneAlignmentResult["method"];

    if (matchResult && matchResult.confidence >= 0.5) {
      // Good match found - ensure it starts at or after previous scene
      startSec = Math.max(matchResult.start, lastEndSec);
      endSec = matchResult.end;
      
      // If the match was adjusted to start later, ensure we don't have negative duration
      if (endSec <= startSec) {
        endSec = startSec + MIN_SCENE_DURATION_SEC;
      }
      
      confidence = matchResult.confidence;
      method = "fuzzy-match";
      lastEndSec = endSec;
    } else {
      // Fallback: Use sequential positioning
      // Estimate duration based on word count (~2.5 words per second for kids narration)
      const wordCount = scene.narrationText.split(/\s+/).filter(Boolean).length;
      const estimatedDuration = Math.max(MIN_SCENE_DURATION_SEC, Math.min(MAX_SCENE_DURATION_SEC, wordCount / 2.5));

      startSec = lastEndSec;
      endSec = Math.min(startSec + estimatedDuration, totalDuration);
      confidence = 0;
      method = matchResult ? "sequential" : "estimated";
      lastEndSec = endSec;
    }

    const duration = endSec - startSec;

    // Check if scene exceeds WAN 2.2 max duration and needs splitting
    if (duration > MAX_SCENE_DURATION_SEC) {
      // Scene is too long - split it at natural boundaries
      const splitScenes = splitLongScene(scene, startSec, endSec, timestamps);
      
      for (const splitScene of splitScenes) {
        alignedScenes.push(splitScene);
        alignmentResults.push({
          sceneNumber: splitScene.sceneNumber,
          startSec: splitScene.startSec ?? 0,
          endSec: splitScene.endSec ?? 0,
          confidence: confidence * 0.9, // Slightly lower confidence for split scenes
          method: "split",
          wasSplit: true,
          originalSceneNumber: scene.sceneNumber,
        });
      }
    } else {
      // Scene is within limits
      alignedScenes.push({
        ...scene,
        startSec,
        endSec,
        estimatedDurationSec: duration,
      });

      alignmentResults.push({
        sceneNumber: scene.sceneNumber,
        startSec,
        endSec,
        confidence,
        method,
      });
    }
  }

  // Post-process: Ensure no gaps or overlaps between scenes
  // and merge very short scenes if needed
  const smoothedScenes = smoothSceneTimings(alignedScenes, totalDuration);

  return {
    alignedScript: {
      ...productionScript,
      scenes: smoothedScenes,
      totalEstimatedDurationSec: totalDuration,
    },
    alignmentResults,
  };
}

/**
 * Split a scene that exceeds the 10-second limit into multiple shorter scenes.
 * Maintains the same visual description with different micro-movements implied.
 * 
 * CRITICAL: This function guarantees:
 * 1. Every produced scene has duration >= MIN_SCENE_DURATION_SEC (3s) and <= MAX_SCENE_DURATION_SEC (10s)
 * 2. The union of all scenes exactly covers [startSec, endSec] with no gaps or truncation
 */
function splitLongScene(
  scene: ProductionScene,
  startSec: number,
  endSec: number,
  timestamps: NarrationTimestampsData
): ProductionScene[] {
  const totalDuration = endSec - startSec;
  
  // If already within limits, return as-is
  if (totalDuration <= MAX_SCENE_DURATION_SEC) {
    return [{
      ...scene,
      startSec,
      endSec,
      estimatedDurationSec: totalDuration,
    }];
  }
  
  // Calculate number of parts needed such that each part is <= MAX_SCENE_DURATION_SEC
  // and >= MIN_SCENE_DURATION_SEC when possible
  const numParts = Math.ceil(totalDuration / MAX_SCENE_DURATION_SEC);
  const idealPartDuration = totalDuration / numParts;
  
  const splitScenes: ProductionScene[] = [];
  let currentStart = startSec;
  
  for (let i = 0; i < numParts; i++) {
    const isLastPart = i === numParts - 1;
    let partEnd: number;

    if (isLastPart) {
      // Last part MUST end at endSec to preserve full coverage
      partEnd = endSec;
    } else {
      // Calculate target end for this part
      const targetEnd = currentStart + idealPartDuration;
      
      // Check if remaining duration after this part would leave a valid last segment
      const remainingAfterTarget = endSec - targetEnd;
      const remainingParts = numParts - i - 1;
      
      // If we're the second-to-last part and the remaining would be >10s, adjust
      if (remainingParts === 1 && remainingAfterTarget > MAX_SCENE_DURATION_SEC) {
        // Split such that last part is exactly MAX_SCENE_DURATION_SEC
        partEnd = endSec - MAX_SCENE_DURATION_SEC;
      } else {
        // Try to find a natural split point near the target
        const splitPoint = findNaturalSplitPoint(currentStart, Math.min(targetEnd + 2, endSec - MIN_SCENE_DURATION_SEC), timestamps);
        
        if (splitPoint && splitPoint > currentStart + MIN_SCENE_DURATION_SEC) {
          partEnd = splitPoint;
        } else {
          partEnd = Math.min(targetEnd, endSec - MIN_SCENE_DURATION_SEC);
        }
      }
      
      // Clamp to valid range: at least MIN_SCENE_DURATION_SEC, at most MAX_SCENE_DURATION_SEC
      const partDuration = partEnd - currentStart;
      if (partDuration < MIN_SCENE_DURATION_SEC) {
        partEnd = currentStart + MIN_SCENE_DURATION_SEC;
      } else if (partDuration > MAX_SCENE_DURATION_SEC) {
        partEnd = currentStart + MAX_SCENE_DURATION_SEC;
      }
      
      // Ensure we don't overshoot endSec
      if (partEnd > endSec) {
        partEnd = endSec;
      }
    }

    // Final validation: ensure this part's duration is valid
    let finalPartEnd = partEnd;
    const partDuration = finalPartEnd - currentStart;
    
    // If duration exceeds max (can happen on last part), we need to split further
    if (partDuration > MAX_SCENE_DURATION_SEC && isLastPart) {
      // Recursively split this oversized last segment
      const subScenes = splitLongScene(scene, currentStart, finalPartEnd, timestamps);
      for (let j = 0; j < subScenes.length; j++) {
        const subScene = subScenes[j];
        splitScenes.push({
          ...subScene,
          sceneNumber: scene.sceneNumber + (splitScenes.length + j) * 0.1,
          transitionHint: splitScenes.length === 0 && j === 0 ? scene.transitionHint : "same-framing",
        });
      }
      break;
    }

    // Get the narration text for this portion (approximate)
    const partNarration = getPartialNarrationText(
      scene.narrationText,
      i,
      numParts
    );

    splitScenes.push({
      ...scene,
      sceneNumber: scene.sceneNumber + i * 0.1, // e.g., 5, 5.1, 5.2
      narrationText: partNarration || scene.narrationText, // Fallback to full text
      startSec: currentStart,
      endSec: finalPartEnd,
      estimatedDurationSec: finalPartEnd - currentStart,
      // Keep same visual description - the video will just continue the motion
      transitionHint: i === 0 ? scene.transitionHint : "same-framing",
    });

    currentStart = finalPartEnd;
  }

  return splitScenes;
}

/**
 * Get approximate portion of narration text for a split scene part.
 * Attempts to split at sentence boundaries.
 */
function getPartialNarrationText(
  fullText: string,
  partIndex: number,
  totalParts: number
): string {
  // Try to split at sentence boundaries
  const sentences = fullText.split(/(?<=[.!?])\s+/);
  
  if (sentences.length >= totalParts) {
    // We have enough sentences to distribute
    const sentencesPerPart = Math.ceil(sentences.length / totalParts);
    const startIdx = partIndex * sentencesPerPart;
    const endIdx = Math.min(startIdx + sentencesPerPart, sentences.length);
    return sentences.slice(startIdx, endIdx).join(" ");
  }

  // Fallback: split by word count
  const words = fullText.split(/\s+/);
  const wordsPerPart = Math.ceil(words.length / totalParts);
  const startIdx = partIndex * wordsPerPart;
  const endIdx = Math.min(startIdx + wordsPerPart, words.length);
  return words.slice(startIdx, endIdx).join(" ");
}

/**
 * Smooth scene timings to eliminate gaps and overlaps.
 * Adjusts boundaries so scenes flow continuously.
 * Enforces the 10-second WAN 2.2 limit on all scenes.
 */
function smoothSceneTimings(
  scenes: ProductionScene[],
  totalDuration: number
): ProductionScene[] {
  if (scenes.length === 0) return scenes;

  const smoothed: ProductionScene[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const prevScene = smoothed[smoothed.length - 1];
    const nextScene = scenes[i + 1];

    let startSec = scene.startSec ?? 0;
    let endSec = scene.endSec ?? (startSec + (scene.estimatedDurationSec || TARGET_SCENE_DURATION_SEC));

    // Ensure no gap from previous scene
    if (prevScene && startSec > (prevScene.endSec ?? 0) + 0.1) {
      // There's a gap - start this one at previous end
      startSec = prevScene.endSec ?? startSec;
    }

    // Ensure no overlap with previous scene
    if (prevScene && startSec < (prevScene.endSec ?? 0)) {
      startSec = prevScene.endSec ?? startSec;
    }

    // Recalculate end based on adjusted start
    const originalDuration = (scene.endSec ?? 0) - (scene.startSec ?? 0);
    if (originalDuration > 0) {
      endSec = startSec + originalDuration;
    }

    // CRITICAL: Enforce 10-second maximum (WAN 2.2 limit)
    if (endSec - startSec > MAX_SCENE_DURATION_SEC) {
      endSec = startSec + MAX_SCENE_DURATION_SEC;
    }

    // For the last scene, extend to total duration if close (but respect max)
    if (!nextScene && endSec < totalDuration - 1) {
      const potentialEnd = totalDuration;
      if (potentialEnd - startSec <= MAX_SCENE_DURATION_SEC) {
        endSec = potentialEnd;
      }
    }

    // Ensure minimum duration
    if (endSec - startSec < MIN_SCENE_DURATION_SEC) {
      endSec = Math.min(startSec + MIN_SCENE_DURATION_SEC, totalDuration);
    }

    // Final check: cap at total duration
    if (endSec > totalDuration) {
      endSec = totalDuration;
    }

    smoothed.push({
      ...scene,
      startSec,
      endSec,
      estimatedDurationSec: endSec - startSec,
    });
  }

  return smoothed;
}

/**
 * Get alignment statistics for debugging/logging
 */
export function getAlignmentStats(results: SceneAlignmentResult[]): {
  totalScenes: number;
  fuzzyMatched: number;
  sequential: number;
  estimated: number;
  split: number;
  scenesExceeding10s: number;
  averageConfidence: number;
  averageDuration: number;
  maxDuration: number;
} {
  const fuzzyMatched = results.filter((r) => r.method === "fuzzy-match").length;
  const sequential = results.filter((r) => r.method === "sequential").length;
  const estimated = results.filter((r) => r.method === "estimated").length;
  const split = results.filter((r) => r.method === "split").length;
  
  const avgConfidence =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
      : 0;

  // Calculate duration stats
  const durations = results.map((r) => r.endSec - r.startSec);
  const avgDuration = durations.length > 0
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length
    : 0;
  const maxDuration = durations.length > 0
    ? Math.max(...durations)
    : 0;
  const exceeding10s = durations.filter((d) => d > MAX_SCENE_DURATION_SEC).length;

  return {
    totalScenes: results.length,
    fuzzyMatched,
    sequential,
    estimated,
    split,
    scenesExceeding10s: exceeding10s,
    averageConfidence: avgConfidence,
    averageDuration: avgDuration,
    maxDuration,
  };
}

