<!-- 4014c1c7-9b59-41a9-8f91-a06a32be73bb 8d6e94f2-de38-4269-8c7d-bc4573d469fb -->
# Audio-Synced Video Clip Generation

## Problem

Currently, all video clips are generated with a fixed 81 frames (~5 seconds) regardless of the actual audio segment duration. This causes:

- Wasted compute when clips are trimmed down
- Potential stretching/looping when audio is longer than video
- Abrupt cuts instead of natural transitions

## Solution

Use the existing `getFramesForDuration()` utility to calculate optimal `numFrames` for each clip based on its audio segment duration from the production script.

## Key Files to Modify

### 1. [src/hooks/use-agent-pipeline.ts](src/hooks/use-agent-pipeline.ts) (lines 3045-3172)

Modify `generateSceneVideos` function to:

- Look up each scene's `startSec`/`endSec` from `productionScript.scenes`
- Calculate target duration (`endSec - startSec`)
- Import and use `getFramesForDuration()` to compute `numFrames`
- Pass `numFrames` in the request body to `/api/video/generate-clip`

### 2. [src/lib/video/fal-client.ts](src/lib/video/fal-client.ts) (line 515)

Already exports `getFramesForDuration()` - no changes needed, just import it.

### 3. [types/agent.ts](types/agent.ts)

Add optional `targetDurationSec` field to `SceneAsset` interface for better tracking and debugging.

### 4. [src/components/agent/StageView.tsx](src/components/agent/StageView.tsx)

(Optional) Display target duration alongside scene info in the video generation UI for transparency.

## Implementation Details

The core change in `generateSceneVideos`:

```typescript
// Look up scene timing from production script
const productionScenes = pipeline.productionScript?.scenes || [];

batch.map(async (scene) => {
  // Find corresponding production scene for timing
  const productionScene = productionScenes.find(
    (ps) => ps.sceneNumber === scene.sceneNumber
  );
  
  // Calculate target duration from audio timestamps
  const targetDuration = productionScene?.endSec && productionScene?.startSec
    ? productionScene.endSec - productionScene.startSec
    : 5; // fallback to 5 seconds
  
  // Calculate optimal frame count
  const numFrames = getFramesForDuration(targetDuration);
  
  const requestBody = {
    sceneNumber: scene.sceneNumber,
    imageUrl: scene.imageUrl,
    prompt: scene.videoPrompt,
    numFrames, // NEW: pass calculated frames
    endImageUrl: scene.lastFrameImageUrl,
  };
  // ... rest of fetch call
});
```

## Constraints

- WAN 2.2 API limits: `numFrames` must be between 17-161 frames
- With default settings (16 fps, 1 interpolated frame), this translates to ~1-10 second clips
- Scenes longer than ~10 seconds will need to be clamped to 161 frames

## Validation

After implementation:

1. Generate videos for a project with varied scene durations
2. Verify in console logs that `numFrames` varies per scene
3. Check that assembled video transitions are smoother without FFmpeg trimming artifacts

### To-dos

- [ ] Modify generateSceneVideos in use-agent-pipeline.ts to calculate numFrames per scene
- [ ] Add targetDurationSec field to SceneAsset type in agent.ts
- [ ] (Optional) Show target duration in StageView for each scene