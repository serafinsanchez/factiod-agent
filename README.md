This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

Create a `.env.local` file with the required API keys:

- `NEXT_PUBLIC_SUPABASE_URL` – your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – anon public key.
- `SUPABASE_SERVICE_ROLE_KEY` – service role key (used only on the server, never expose it to the client).
- `GEMINI_API_KEY` – for thumbnail generation.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` – for TTS (see `src/lib/tts/elevenlabs.ts`).
- `ELEVENLABS_MULTILINGUAL_V2_VOICE` – (optional) preset voice name for the Multilingual v2 model (e.g., `Daniel`, `Rachel`, `Aria`). Defaults to `Daniel`. Custom voice IDs may produce silent audio with this model.
- `OPENAI_API_KEY` – for the default GPT-5.1 model.
- `MOONSHOT_API_KEY` – for the Kimi K2 Thinking model (`kimik2-thinking`).
- `ANTHROPIC_API_KEY` – for the Claude Sonnet 4.5 model (`claude-sonnet-4.5`) via the Anthropic Messages API.
- `FAL_KEY` – for Whisper audio transcription and video generation via fal.ai.

After setting the keys you can dry-run individual models with:

```bash
pnpm ts-node --transpile-only scripts/test-llm.ts claude-sonnet-4.5
```

Omit the final argument to hit the Kimi model or pass any supported `ModelId`. The script prints the raw response plus token usage and the estimated cost, which is handy for verifying new keys locally.

## Narration Timestamps API

The app includes an API endpoint to extract word-level timestamps from narration audio using Whisper transcription. This enables precise audio-video synchronization in the video assembly pipeline.

### Endpoint: `POST /api/audio/timestamps`

Extract word-level timestamps from a publicly accessible audio URL.

**Request:**
```bash
curl -X POST http://localhost:3000/api/audio/timestamps \
  -H 'Content-Type: application/json' \
  -d '{
    "audioUrl": "https://example.com/narration.mp3",
    "language": "en",
    "modelId": "WHISPER"
  }'
```

**Response:**
```json
{
  "timestamps": {
    "words": [
      { "word": "Hello", "start": 0.0, "end": 0.5 },
      { "word": "world", "start": 0.5, "end": 1.0 }
    ],
    "segments": [
      {
        "text": "Hello world",
        "start": 0.0,
        "end": 1.0,
        "words": [...]
      }
    ],
    "totalDurationSec": 1.0
  },
  "durationMs": 1234
}
```

**Parameters:**
- `audioUrl` (required): Public HTTPS URL of the audio file to transcribe
- `language` (optional): Language code (e.g., "en"). Auto-detected if not specified
- `modelId` (optional): Whisper model to use - `"WHISPER"` (default) or `"WIZPER"` (2x faster)

**Health Check: `GET /api/audio/timestamps`**

Check if Whisper transcription is configured:
```bash
curl http://localhost:3000/api/audio/timestamps
```

Returns `{"whisperAvailable": true}` if `FAL_KEY` is set.

## Supabase Configuration

The app stores project history (one project per video) and media assets (script, audio, thumbnail) in Supabase.

> **Project history behavior:** Every click of **Save Project** inserts a brand-new row in the `projects` table, even if you reuse the same topic. This guarantees the sidebar shows every past run. Projects that were overwritten by the previous upsert behavior can’t be automatically restored, but all future saves will be preserved as separate entries.

### Database schema (`projects` table)

**Step 1: Create the table**

Run the migration SQL file in your Supabase SQL Editor:

1. Go to your Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migrations/001_create_projects_table.sql`
3. Click "Run" to execute the migration

Alternatively, you can run the SQL directly:

```sql
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  topic text not null,
  model text not null,
  title text,
  description text,

  project_slug text not null,
  script_path text,
  audio_path text,
  thumbnail_path text,

  pipeline jsonb not null
);

create index if not exists idx_projects_created_at on public.projects(created_at desc);
create index if not exists idx_projects_project_slug on public.projects(project_slug);
```

**Step 2: Refresh the schema cache**

After creating the table, you **must** refresh Supabase's schema cache:

1. Go to Supabase Dashboard → Settings → API
2. Scroll down to find "Schema Cache"
3. Click **"Rebuild Schema Cache"** or **"Reload Schema"**

This is critical! Without refreshing the cache, you'll see `PGRST205` errors saying the table can't be found, even though it exists.

**Note:** Row Level Security can be enabled later and tied to a `user_id` column when you add authentication. For now you can keep RLS disabled or add permissive policies for development.

### Storage bucket structure

**Step 1: Create the storage bucket**

Run the storage migration SQL file in your Supabase SQL Editor:

1. Go to your Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migrations/002_create_storage_bucket.sql`
3. Click "Run" to execute the migration

This will create a public storage bucket named `projects` with appropriate access policies.

Alternatively, you can manually create the bucket:

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name it `projects`
4. Set it to **Public** (so generated assets can be accessed via URL)
5. Click "Create bucket"

**Folder structure:**

Each saved project gets its own folder:

- Folder: `projects/<project_slug>/`
  - `projects/<project_slug>/<project_slug>.md` – full script as markdown.
  - `projects/<project_slug>/<project_slug>-audio.mp3` – generated narration audio.
  - `projects/<project_slug>/<project_slug>-thumbnail.png` – generated thumbnail image.

The code assumes these paths when saving assets and when reconstructing URLs for playback/download.

## Narration Post-processing

The pipeline automatically performs two hidden clean-up steps after the main script is generated:

- **Narration Cleaner** removes any stage directions or production notes so ElevenLabs only receives spoken lines.
- **Narration Audio Tags** enriches the cleaned narration with ElevenLabs v3 audio tags (e.g., `[whispers]`, `[laughs]`, `[sighs]`) without changing the underlying words. Tags appear directly inside the final `NarrationScript`, so exporting or generating TTS audio will include the expressive cues automatically.

No additional configuration is required—complete a normal run of the `script` step (or click **Run All**) and the hidden narration steps fire sequentially. If an enhancement step ever fails, its status is surfaced in the UI so you can retry once your script is ready.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
