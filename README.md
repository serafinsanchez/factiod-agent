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

Create a `.env.local` file with the required ElevenLabs credentials before running the TTS features:

```
ELEVENLABS_API_KEY=your_xi_api_key
ELEVENLABS_VOICE_ID=your_voice_id
ELEVENLABS_MODEL_ID=eleven_v3
```

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
