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

## Supabase configuration

The app stores project history (one project per video) and media assets (script, audio, thumbnail) in Supabase.

### Environment variables

Add the following to your environment (for example, `.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL` – your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – anon public key.
- `SUPABASE_SERVICE_ROLE_KEY` – service role key (used only on the server, never expose it to the client).

You will also need:

- `GEMINI_API_KEY` – for thumbnail generation.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` – for TTS (see `src/lib/tts/elevenlabs.ts`).

### Database schema (`projects` table)

Create a `projects` table to store full pipeline snapshots and asset paths:

```sql
create table public.projects (
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
```

Row Level Security can be enabled later and tied to a `user_id` column when you add authentication. For now you can keep RLS disabled or add permissive policies for development.

### Storage bucket structure

Create a Supabase Storage bucket named `projects`. Each saved project gets its own folder:

- Folder: `projects/<project_slug>/`
  - `projects/<project_slug>/<project_slug>.md` – full script as markdown.
  - `projects/<project_slug>/<project_slug>-audio.mp3` – generated narration audio.
  - `projects/<project_slug>/<project_slug>-thumbnail.png` – generated thumbnail image.

The code assumes these paths when saving assets and when reconstructing URLs for playback/download.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
