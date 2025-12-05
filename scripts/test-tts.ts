/**
 * Test script to debug ElevenLabs TTS via fal.ai
 * Run with: pnpm ts-node --transpile-only scripts/test-tts.ts
 */

import { fal } from '@fal-ai/client';
import * as fs from 'fs';
import * as path from 'path';

const FAL_KEY = process.env.FAL_KEY;

if (!FAL_KEY) {
  console.error('FAL_KEY environment variable is not set');
  process.exit(1);
}

fal.config({
  credentials: FAL_KEY,
});

const TEST_TEXT = "Hello! This is a test of the ElevenLabs text to speech system. Can you hear me? One, two, three, four, five.";

const VOICES_TO_TEST = ['Aria', 'Daniel', 'Rachel', 'Brian', 'Sarah'];

interface FalTtsResult {
  data: {
    audio: {
      url: string;
      content_type?: string;
      file_name?: string;
      file_size?: number;
    };
  };
  requestId: string;
}

async function testVoice(voice: string, model: string, endpoint: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${model} with voice "${voice}"`);
  console.log('='.repeat(60));

  try {
    const startTime = Date.now();
    
    const result = (await fal.subscribe(endpoint, {
      input: {
        text: TEST_TEXT,
        voice,
        stability: 0.5,
        similarity_boost: 0.75,
      },
    })) as FalTtsResult;

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✓ API call completed in ${duration}s`);
    console.log(`  Audio URL: ${result.data.audio.url}`);
    console.log(`  Content-Type: ${result.data.audio.content_type || 'not specified'}`);
    console.log(`  File Size (reported): ${result.data.audio.file_size || 'not specified'}`);

    // Download the audio
    const res = await fetch(result.data.audio.url);
    if (!res.ok) {
      console.error(`✗ Failed to download audio: ${res.status} ${res.statusText}`);
      return;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`  Downloaded size: ${buffer.length} bytes`);

    // Check if it looks like a valid MP3 (starts with ID3 or FF FB/FA/F3)
    const header = buffer.slice(0, 10);
    const isID3 = header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33; // "ID3"
    const isMP3Frame = header[0] === 0xFF && (header[1] & 0xE0) === 0xE0;
    
    console.log(`  Header bytes: ${header.toString('hex').toUpperCase()}`);
    console.log(`  Looks like valid MP3: ${isID3 || isMP3Frame ? 'Yes' : 'No (check header)'}`);

    // Check for silence by looking at the audio data
    // In MP3, complete silence would have very repetitive patterns
    const sample = buffer.slice(0, Math.min(1000, buffer.length));
    const uniqueBytes = new Set(sample).size;
    console.log(`  Unique bytes in first 1KB: ${uniqueBytes} (low = possibly silent)`);

    // Save the file for manual inspection
    const outputDir = path.join(__dirname, '..', 'tmp');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFile = path.join(outputDir, `test-${model.replace('/', '-')}-${voice}.mp3`);
    fs.writeFileSync(outputFile, buffer);
    console.log(`  Saved to: ${outputFile}`);
    console.log(`  → Open this file in a media player to verify audio`);

  } catch (error) {
    console.error(`✗ Error testing ${voice}:`, error);
  }
}

async function main() {
  console.log('ElevenLabs TTS Test via fal.ai');
  console.log('==============================\n');
  console.log(`Test text: "${TEST_TEXT}"\n`);

  // Test multilingual-v2 with different voices
  console.log('\n>>> TESTING MULTILINGUAL V2 <<<');
  for (const voice of VOICES_TO_TEST) {
    await testVoice(voice, 'multilingual-v2', 'fal-ai/elevenlabs/tts/multilingual-v2');
  }

  // Also test eleven-v3 for comparison
  console.log('\n\n>>> TESTING ELEVEN V3 (for comparison) <<<');
  await testVoice('Daniel', 'eleven-v3', 'fal-ai/elevenlabs/tts/eleven-v3');

  console.log('\n\nDone! Check the tmp/ folder for the downloaded audio files.');
  console.log('Play each file to verify which ones have actual audio.');
}

main().catch(console.error);

