# Settings Page Documentation

The settings page provides a centralized location to configure all aspects of the PIP Academy video generation pipeline.

## Location

Navigate to `/settings` to access the settings page.

## Structure

Settings are organized into 6 tabs:

### 1. Script + Audio

Configure LLM models, text-to-speech, and script generation prompts.

**Model & Defaults:**
- LLM Model selection (Claude, GPT, Kimik2, Gemini)
- Default word count for scripts (~1500 words = ~10 minutes)

**Audio Settings:**
- ElevenLabs Voice ID
- Narration model (V3 or Multilingual V2)
- Stability (0-1): Higher = more consistent, lower = more expressive
- Similarity Boost (0-1): How closely to match the voice

**Prompts:**
- Key Concepts extraction
- Hook generation
- Quiz generation
- Script generation
- Script QA
- Narration cleaner
- Audio tags for ElevenLabs

### 2. Timing + Storyboard

Configure production script generation and scene duration constraints.

**Scene Duration:**
- Minimum duration: 5 seconds (default)
- Maximum duration: 10 seconds (WAN 2.2 limit)

**Prompts:**
- Production Script: Converts video script into scene-by-scene breakdown

### 3. Imagery

Configure visual styles and image generation.

**Visual Style & Mode:**
- Default Visual Style: Pixar-3D, Paper Craft, or Documentary
- Video Frame Mode: FLF2V (First-Last-Frame) or First-Frame-Only
- Character Reference: Enable for character consistency (Pixar-3D)

**Prompts:**
- Scene Image Prompts: Generate image prompts for each scene

### 4. Video Gen

Configure WAN 2.2 video generation model and parameters.

**Model & Preset:**
- Video Model: WAN 2.2 (14B), WAN 2.2 Small, WAN 2.1, MiniMax
- Preset: Quality, Smooth, Balanced, or Fast

**Quality Settings:**
- Resolution: 480p, 580p, or 720p
- Aspect Ratio: Auto, 16:9, 9:16, 1:1

**Generation Parameters:**
- Inference Steps (2-40): Higher = better quality, slower
- Guidance Scale (1-10): Higher = better prompt adherence

**Interpolation:**
- Interpolator Model: FILM (recommended), RIFE, or None
- Interpolated Frames (0-4): Frames between each pair

**Negative Prompt:**
- Elements to avoid in generation

**Prompts:**
- Scene Video Prompts: Motion prompts for video generation

### 5. Publishing

Configure title, description, and thumbnail generation.

**Default Promo Copy:**
- Optional text to append to video descriptions

**Prompts:**
- Title & Description: YouTube metadata generation
- Thumbnail Prompt: Thumbnail creative brief

### 6. Global

General application settings and API key status.

**API Keys Status:**
- Shows configuration status for Gemini, FAL, and ElevenLabs
- Keys are configured in `.env.local` file

**Project Defaults:**
- Default Project Creator: Name shown in project lists

**Preferences:**
- Auto-save drafts: Automatically save work in progress
- Cost tracking display: Show API costs in UI

## Storage

Settings are stored in Supabase in the `user_settings` table. Each tab's settings are saved independently as JSON objects.

**To apply the database migration:**

```bash
# If using Supabase CLI locally:
supabase db reset

# Or apply the migration directly:
psql -d your_database -f supabase/migrations/004_user_settings.sql
```

## Usage

1. Navigate to the settings page
2. Select a tab from the left sidebar
3. Modify settings as needed
4. Click "Save Changes" to persist
5. Use "Reset to Defaults" to restore original values

## Defaults

All settings have sensible defaults extracted from the codebase:
- Prompts are populated from `lib/agent/steps.ts`
- Model defaults match production configuration
- All numeric parameters match WAN 2.2 and ElevenLabs recommendations

## Future Enhancements

- User authentication to store per-user settings
- Export/import settings as JSON
- Preset configurations for different content types
- Settings history and version control
