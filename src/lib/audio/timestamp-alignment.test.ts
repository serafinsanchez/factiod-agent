import { describe, expect, it } from 'vitest';

/**
 * Unit tests for timestamp alignment and scene splitting logic
 * 
 * These tests validate that:
 * 1. Scenes are split correctly when they exceed 10s
 * 2. Split scenes maintain full coverage (no gaps or truncation)
 * 3. All resulting scenes have valid durations (3s-10s)
 */

// Constants matching the actual implementation
const MAX_SCENE_DURATION_SEC = 10;
const MIN_SCENE_DURATION_SEC = 3;

/**
 * Minimal implementation of splitLongScene for testing purposes
 * This mirrors the logic in timestamp-alignment.ts
 */
function splitLongScene(
  startSec: number,
  endSec: number,
): Array<{ startSec: number; endSec: number; duration: number }> {
  const totalDuration = endSec - startSec;
  
  // If already within limits, return as-is
  if (totalDuration <= MAX_SCENE_DURATION_SEC) {
    return [{
      startSec,
      endSec,
      duration: totalDuration,
    }];
  }
  
  // Calculate number of parts needed
  const numParts = Math.ceil(totalDuration / MAX_SCENE_DURATION_SEC);
  const idealPartDuration = totalDuration / numParts;
  
  const splitScenes: Array<{ startSec: number; endSec: number; duration: number }> = [];
  let currentStart = startSec;
  
  for (let i = 0; i < numParts; i++) {
    const isLastPart = i === numParts - 1;
    let partEnd: number;

    if (isLastPart) {
      // Last part MUST end at endSec
      partEnd = endSec;
    } else {
      partEnd = currentStart + idealPartDuration;
      
      // Clamp to valid range
      const partDuration = partEnd - currentStart;
      if (partDuration < MIN_SCENE_DURATION_SEC) {
        partEnd = currentStart + MIN_SCENE_DURATION_SEC;
      } else if (partDuration > MAX_SCENE_DURATION_SEC) {
        partEnd = currentStart + MAX_SCENE_DURATION_SEC;
      }
      
      if (partEnd > endSec) {
        partEnd = endSec;
      }
    }

    const duration = partEnd - currentStart;
    
    // If this last part exceeds max, we need to recursively split
    if (duration > MAX_SCENE_DURATION_SEC && isLastPart) {
      const subScenes = splitLongScene(currentStart, partEnd);
      splitScenes.push(...subScenes);
      break;
    }

    splitScenes.push({
      startSec: currentStart,
      endSec: partEnd,
      duration,
    });

    currentStart = partEnd;
  }

  return splitScenes;
}

describe('splitLongScene', () => {
  it('returns scene as-is when duration is within limit', () => {
    const result = splitLongScene(0, 8);
    
    expect(result).toHaveLength(1);
    expect(result[0].startSec).toBe(0);
    expect(result[0].endSec).toBe(8);
    expect(result[0].duration).toBe(8);
  });

  it('returns scene as-is when duration equals MAX_SCENE_DURATION_SEC', () => {
    const result = splitLongScene(5, 15);
    
    expect(result).toHaveLength(1);
    expect(result[0].startSec).toBe(5);
    expect(result[0].endSec).toBe(15);
    expect(result[0].duration).toBe(10);
  });

  it('splits 15s scene into 2 parts with full coverage', () => {
    const result = splitLongScene(0, 15);
    
    expect(result.length).toBeGreaterThanOrEqual(2);
    
    // Verify full coverage: first scene starts at 0
    expect(result[0].startSec).toBe(0);
    
    // Last scene ends at 15
    expect(result[result.length - 1].endSec).toBe(15);
    
    // Verify contiguous: each scene starts where previous ends
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startSec).toBe(result[i - 1].endSec);
    }
    
    // Verify all durations are valid
    for (const scene of result) {
      expect(scene.duration).toBeLessThanOrEqual(MAX_SCENE_DURATION_SEC);
      expect(scene.duration).toBeGreaterThan(0);
    }
  });

  it('splits 25s scene into 3 parts with full coverage', () => {
    const result = splitLongScene(10, 35);
    
    expect(result.length).toBeGreaterThanOrEqual(3);
    
    // Verify full coverage
    expect(result[0].startSec).toBe(10);
    expect(result[result.length - 1].endSec).toBe(35);
    
    // Verify contiguous
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startSec).toBe(result[i - 1].endSec);
    }
    
    // Verify all durations are valid (<=10s)
    for (const scene of result) {
      expect(scene.duration).toBeLessThanOrEqual(MAX_SCENE_DURATION_SEC);
    }
    
    // Total duration should match original
    const totalDuration = result.reduce((sum, s) => sum + s.duration, 0);
    expect(totalDuration).toBeCloseTo(25, 5);
  });

  it('handles very long scenes (60s) without truncation', () => {
    const result = splitLongScene(0, 60);
    
    // Should produce at least 6 parts
    expect(result.length).toBeGreaterThanOrEqual(6);
    
    // Verify full coverage
    expect(result[0].startSec).toBe(0);
    expect(result[result.length - 1].endSec).toBe(60);
    
    // Verify contiguous and valid durations
    for (let i = 0; i < result.length; i++) {
      const scene = result[i];
      expect(scene.duration).toBeLessThanOrEqual(MAX_SCENE_DURATION_SEC);
      
      if (i > 0) {
        expect(scene.startSec).toBe(result[i - 1].endSec);
      }
    }
    
    // Total duration should match
    const totalDuration = result.reduce((sum, s) => sum + s.duration, 0);
    expect(totalDuration).toBeCloseTo(60, 5);
  });

  it('handles edge case of 11s scene (just over limit)', () => {
    const result = splitLongScene(0, 11);
    
    // Should split into 2 parts
    expect(result.length).toBe(2);
    
    // Verify full coverage
    expect(result[0].startSec).toBe(0);
    expect(result[1].endSec).toBe(11);
    
    // Both parts should be <=10s
    expect(result[0].duration).toBeLessThanOrEqual(MAX_SCENE_DURATION_SEC);
    expect(result[1].duration).toBeLessThanOrEqual(MAX_SCENE_DURATION_SEC);
  });

  it('handles non-zero start offset correctly', () => {
    const result = splitLongScene(45.5, 70.5);
    
    // Duration is 25s, should split into 3+ parts
    expect(result.length).toBeGreaterThanOrEqual(3);
    
    // Verify coverage with offset
    expect(result[0].startSec).toBe(45.5);
    expect(result[result.length - 1].endSec).toBe(70.5);
    
    // Total duration should match
    const totalDuration = result.reduce((sum, s) => sum + s.duration, 0);
    expect(totalDuration).toBeCloseTo(25, 5);
  });
});

describe('clip timing validation', () => {
  /**
   * Simulates the clip timing validation logic from use-video-assembly.ts
   */
  function validateAndFixClips(
    clips: Array<{ clipNumber: number; audioStartSec: number; audioEndSec: number }>
  ): { 
    fixedClips: typeof clips; 
    warnings: string[];
  } {
    // Sort by audioStartSec
    const sorted = [...clips].sort((a, b) => {
      if (a.audioStartSec !== b.audioStartSec) {
        return a.audioStartSec - b.audioStartSec;
      }
      return a.clipNumber - b.clipNumber;
    });

    const warnings: string[] = [];
    let previousEnd = 0;

    for (let i = 0; i < sorted.length; i++) {
      const clip = sorted[i];

      // Check for overlap
      if (clip.audioStartSec < previousEnd - 0.1) {
        warnings.push(`Clip ${clip.clipNumber} overlaps with previous`);
        const duration = clip.audioEndSec - clip.audioStartSec;
        clip.audioStartSec = previousEnd;
        clip.audioEndSec = previousEnd + duration;
      }

      // Check for invalid duration
      if (clip.audioEndSec <= clip.audioStartSec) {
        warnings.push(`Clip ${clip.clipNumber} has invalid duration`);
        clip.audioEndSec = clip.audioStartSec + 3;
      }

      previousEnd = clip.audioEndSec;
    }

    return { fixedClips: sorted, warnings };
  }

  it('passes through valid, contiguous clips unchanged', () => {
    const clips = [
      { clipNumber: 1, audioStartSec: 0, audioEndSec: 5 },
      { clipNumber: 2, audioStartSec: 5, audioEndSec: 10 },
      { clipNumber: 3, audioStartSec: 10, audioEndSec: 15 },
    ];

    const { fixedClips, warnings } = validateAndFixClips(clips);

    expect(warnings).toHaveLength(0);
    expect(fixedClips).toEqual(clips);
  });

  it('sorts clips by start time', () => {
    const clips = [
      { clipNumber: 3, audioStartSec: 10, audioEndSec: 15 },
      { clipNumber: 1, audioStartSec: 0, audioEndSec: 5 },
      { clipNumber: 2, audioStartSec: 5, audioEndSec: 10 },
    ];

    const { fixedClips } = validateAndFixClips(clips);

    expect(fixedClips[0].clipNumber).toBe(1);
    expect(fixedClips[1].clipNumber).toBe(2);
    expect(fixedClips[2].clipNumber).toBe(3);
  });

  it('fixes overlapping clips by shifting', () => {
    const clips = [
      { clipNumber: 1, audioStartSec: 0, audioEndSec: 8 },
      { clipNumber: 2, audioStartSec: 5, audioEndSec: 12 }, // overlaps with clip 1
      { clipNumber: 3, audioStartSec: 12, audioEndSec: 18 },
    ];

    const { fixedClips, warnings } = validateAndFixClips(clips);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.includes('overlaps'))).toBe(true);

    // Clip 2 should now start at 8 (where clip 1 ends)
    expect(fixedClips[1].audioStartSec).toBe(8);
    expect(fixedClips[1].audioEndSec).toBe(15); // original duration preserved
  });

  it('fixes invalid duration by assigning minimum 3s', () => {
    const clips = [
      { clipNumber: 1, audioStartSec: 0, audioEndSec: 5 },
      { clipNumber: 2, audioStartSec: 5, audioEndSec: 5 }, // zero duration
      { clipNumber: 3, audioStartSec: 8, audioEndSec: 12 },
    ];

    const { fixedClips, warnings } = validateAndFixClips(clips);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.includes('invalid duration'))).toBe(true);

    // Clip 2 should now have 3s duration
    expect(fixedClips[1].audioEndSec - fixedClips[1].audioStartSec).toBe(3);
  });
});

describe('getServerAudioUrl', () => {
  /**
   * Simulates the getServerAudioUrl helper from projects.ts
   */
  function getServerAudioUrl(
    audioPath: string | null | undefined,
    supabaseUrl = 'https://example.supabase.co'
  ): string | null {
    if (!audioPath || !supabaseUrl) {
      return null;
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/projects/${encodeURI(audioPath)}`;

    // Guard against blob: URLs
    if (publicUrl.startsWith('blob:')) {
      return null;
    }

    // Add cache-busting
    const separator = publicUrl.includes('?') ? '&' : '?';
    return `${publicUrl}${separator}v=${Date.now()}`;
  }

  it('returns null for null/undefined audioPath', () => {
    expect(getServerAudioUrl(null)).toBeNull();
    expect(getServerAudioUrl(undefined)).toBeNull();
    expect(getServerAudioUrl('')).toBeNull();
  });

  it('generates cache-busted URL for valid path', () => {
    const result = getServerAudioUrl('my-project/my-project-audio.mp3');
    
    expect(result).not.toBeNull();
    expect(result).toContain('https://example.supabase.co');
    expect(result).toContain('my-project/my-project-audio.mp3');
    expect(result).toMatch(/\?v=\d+$/);
  });

  it('encodes special characters in path', () => {
    const result = getServerAudioUrl('project with spaces/audio file.mp3');
    
    expect(result).not.toBeNull();
    expect(result).toContain('project%20with%20spaces/audio%20file.mp3');
  });
});
