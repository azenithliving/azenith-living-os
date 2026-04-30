import { put } from '@vercel/blob';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const videos = [
  'hero-1.mp4',
  'hero-2.mp4',
  'hero-3.mp4',
  'hero-4.mp4',
  'hero-5.mp4',
  'hero-6.mp4',
];

async function uploadVideos() {
  const results: Record<string, string> = {};
  
  for (const video of videos) {
    const filePath = resolve(process.cwd(), 'public/videos', video);
    const fileBuffer = readFileSync(filePath);
    
    console.log(`Uploading ${video} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)...`);
    
    const blob = await put(`videos/${video}`, fileBuffer, {
      access: 'public',
      contentType: 'video/mp4',
    });
    
    results[video] = blob.url;
    console.log(`✅ Uploaded: ${blob.url}`);
  }
  
  console.log('\n--- Video URLs for AzenithLegacy.tsx ---');
  console.log(JSON.stringify(results, null, 2));
}

uploadVideos().catch(console.error);
