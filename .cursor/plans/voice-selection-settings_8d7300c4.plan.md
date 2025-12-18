---
name: voice-selection-settings
overview: Implement voice selection in audio settings to allow users to choose between specific ElevenLabs voices (Pip the Penguin and Juniper) for narration generation.
todos:
  - id: ui-update
    content: Replace Input with Select in ScriptAudioSettings.tsx
    status: pending
  - id: hook-update
    content: Add voiceId parameter to useNarrationAudio hook
    status: pending
  - id: pipeline-integration
    content: Pass voiceId from settings in useAgentPipeline.ts
    status: pending
---

1.  **Update UI**: Modify `src/components/settings/sections/ScriptAudioSettings.tsx` to replace the free-text `Input` for "Audio Voice ID" with a `Select` dropdown containing the specific voice options requested.