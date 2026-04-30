#!/usr/bin/env ts-node
/**
 * Advanced Image Curation Test Script
 * Tests the multi-stage filtering pipeline on one category: "غرفة معيشة - مودرن"
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';
import sharp from 'sharp';
import { put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

// ============ Types ============
interface PexelsImage {
  id: number;
  width: number;
  height: number;
  url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  alt: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  liked: boolean;
}

interface ImageData {
  id: number;
  url: string;
  src: {
    original: string;
    large: string;
    medium: string;
  };
  alt: string;
  photographer: string;
  width: number;
  height: number;
}

interface GeminiScore {
  score: number;
  reason: string;
}

interface CuratedImage {
  id: number;
  url: string;
  storagePath: string;
  storageProvider: 'vercel' | 'supabase';
  score: number;
  metadata: {
    width: number;
    height: number;
    photographer: string;
    alt: string;
    compressedSize: number;
  };
}

// ============ Key Rotators ============
class KeyRotator {
  private keys: string[];
  private currentIndex: number = 0;

  constructor(envVar: string) {
    const value = process.env[envVar] || '';
    this.keys = value.split(',').map(k => k.trim()).filter(Boolean);
    if (this.keys.length === 0) {
      throw new Error(`No keys found for ${envVar}`);
    }
    console.log(`[KeyRotator] Loaded ${this.keys.length} keys for ${envVar}`);
  }

  getNext(): string {
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  getAll(): string[] {
    return this.keys;
  }
}

// Initialize key rotators
const pexelsRotator = new KeyRotator('PEXELS_KEYS');
const groqRotator = new KeyRotator('GROQ_KEYS');
const openRouterRotator = new KeyRotator('OPENROUTER_KEYS');

// ============ Services ============
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============ Helper Functions ============
async function fetchFromPexels(query: string, page: number, perPage: number = 80): Promise<ImageData[]> {
  const apiKey = pexelsRotator.getNext();
  
  try {
    const response = await axios.get('https://api.pexels.com/v1/search', {
      headers: {
        Authorization: apiKey,
      },
      params: {
        query,
        page,
        per_page: perPage,
        orientation: 'all',
      },
      timeout: 30000,
    });

    const photos: PexelsImage[] = response.data.photos || [];
    
    return photos.map((photo: PexelsImage) => ({
      id: photo.id,
      url: photo.url,
      src: {
        original: photo.src.original,
        large: photo.src.large,
        medium: photo.src.medium,
      },
      alt: photo.alt || '',
      photographer: photo.photographer,
      width: photo.width,
      height: photo.height,
    }));
  } catch (error) {
    console.error(`[Pexels] Error fetching page ${page}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

async function groqFilter(image: ImageData): Promise<boolean> {
  const apiKey = groqRotator.getNext();
  
  const prompt = `هل هذه الصورة تصف غرفة معيشة عصرية فاخرة؟ أجب بنعم أو لا فقط. العنوان: ${image.alt || 'غير متوفر'}`;
  
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'أنت مساعد متخصص في تحليل الصور والتصميم الداخلي. أجب بنعم أو لا فقط.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 10,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const answer = response.data.choices?.[0]?.message?.content?.toLowerCase() || '';
    const isRelevant = answer.includes('نعم') || answer.includes('yes');
    
    console.log(`[Groq] Image ${image.id}: ${isRelevant ? '✓' : '✗'} (${answer})`);
    return isRelevant;
  } catch (error) {
    console.error(`[Groq] Error filtering image ${image.id}:`, error instanceof Error ? error.message : error);
    return true; // Include on error to not lose images
  }
}

async function openRouterScore(image: ImageData): Promise<GeminiScore | null> {
  const apiKey = openRouterRotator.getNext();

  try {
    const imageResponse = await axios.get(image.src.medium, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const base64Image = Buffer.from(imageResponse.data).toString('base64');

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-flash-1.5',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `Score this image 1-10 for "modern luxury living room". Return JSON: {score: number, reason: string}` },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    const parsed: GeminiScore = JSON.parse(content);
    console.log(`[OpenRouter] Image ${image.id}: Score ${parsed.score}/10`);
    return parsed;
  } catch (error) {
    console.error(`[OpenRouter] Error scoring image ${image.id}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function compressImage(imageUrl: string, outputPath: string): Promise<{ path: string; size: number }> {
  try {
    // Download image
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    const buffer = Buffer.from(response.data);
    
    // Compress with sharp
    const compressed = await sharp(buffer)
      .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();
    
    // Save to temp
    fs.writeFileSync(outputPath, compressed);
    
    const stats = fs.statSync(outputPath);
    console.log(`[Compress] Compressed to ${(stats.size / 1024).toFixed(1)} KB`);
    
    return { path: outputPath, size: stats.size };
  } catch (error) {
    console.error(`[Compress] Error:`, error instanceof Error ? error.message : error);
    throw error;
  }
}

async function uploadToVercelBlob(
  filePath: string,
  blobPath: string
): Promise<string> {
  const fileContent = fs.readFileSync(filePath);
  
  const blob = await put(blobPath, fileContent, {
    access: 'public',
    contentType: 'image/jpeg',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  
  console.log(`[Vercel Blob] Uploaded: ${blob.url}`);
  return blob.url;
}

async function uploadToSupabase(
  filePath: string,
  storagePath: string
): Promise<string> {
  const fileContent = fs.readFileSync(filePath);
  
  const { data, error } = await supabase.storage
    .from('curated_images')
    .upload(storagePath, fileContent, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  
  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }
  
  const { data: urlData } = supabase.storage
    .from('curated_images')
    .getPublicUrl(storagePath);
  
  console.log(`[Supabase] Uploaded: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

// ============ Main Pipeline ============
async function main() {
  console.log('\n🚀 Starting Advanced Image Curation Test\n');
  console.log('Category: غرفة معيشة - مودرن (Modern Living Room)\n');

  // 1. Fetch 500 images from Pexels
  console.log('📥 Step 1: Fetching 500 images from Pexels...');
  const allImages: ImageData[] = [];
  const query = 'modern living room luxury interior design';
  
  for (let page = 1; page <= 7; page++) {
    console.log(`  Fetching page ${page}/7...`);
    const images = await fetchFromPexels(query, page, 80);
    allImages.push(...images);
    
    // Rate limiting delay
    if (page < 7) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`✓ Fetched ${allImages.length} images\n`);

  // 2. Groq Text Filtering
  console.log('🔍 Step 2: Groq text-based filtering...');
  const textFiltered: ImageData[] = [];
  
  for (let i = 0; i < allImages.length; i++) {
    const image = allImages[i];
    console.log(`  Processing ${i + 1}/${allImages.length}...`);
    
    const isRelevant = await groqFilter(image);
    if (isRelevant) {
      textFiltered.push(image);
    }
    
    // Rate limiting
    if (i < allImages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`✓ ${textFiltered.length} images passed text filtering\n`);

  // 3. OpenRouter Visual Scoring
  console.log('🎨 Step 3: OpenRouter visual filtering & scoring...');
  const scoredImages: Array<{ image: ImageData; score: GeminiScore }> = [];
  
  for (let i = 0; i < textFiltered.length; i++) {
    const image = textFiltered[i];
    console.log(`  Scoring ${i + 1}/${textFiltered.length}...`);
    
    const score = await openRouterScore(image);
    if (score && score.score >= 9) {
      scoredImages.push({ image, score });
    }
    
    // Rate limiting
    if (i < textFiltered.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Sort by score and take top 50
  scoredImages.sort((a, b) => b.score.score - a.score.score);
  const topImages = scoredImages.slice(0, 50);
  
  console.log(`✓ ${topImages.length} images scored 9+ and kept\n`);

  // 4. Image Compression
  console.log('🗜️  Step 4: Compressing images...');
  const tempDir = './temp_images';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const compressedImages: Array<{
    image: ImageData;
    score: GeminiScore;
    compressedPath: string;
    compressedSize: number;
  }> = [];
  
  for (let i = 0; i < topImages.length; i++) {
    const { image, score } = topImages[i];
    const outputPath = path.join(tempDir, `img_${image.id}.jpg`);
    
    console.log(`  Compressing ${i + 1}/${topImages.length}...`);
    
    try {
      const result = await compressImage(image.src.large, outputPath);
      compressedImages.push({
        image,
        score,
        compressedPath: result.path,
        compressedSize: result.size,
      });
    } catch {
      console.log(`  ✗ Failed to compress image ${image.id}`);
    }
  }
  
  console.log(`✓ ${compressedImages.length} images compressed\n`);

  // 5. Hybrid Storage
  console.log('☁️  Step 5: Uploading to hybrid storage...');
  const curatedImages: CuratedImage[] = [];
  
  // First 40 to Vercel Blob
  console.log('  Uploading first 40 to Vercel Blob...');
  for (let i = 0; i < Math.min(40, compressedImages.length); i++) {
    const { image, score, compressedPath, compressedSize } = compressedImages[i];
    const blobPath = `curated/living-room-modern/img_${image.id}.jpg`;
    
    try {
      const url = await uploadToVercelBlob(compressedPath, blobPath);
      curatedImages.push({
        id: image.id,
        url,
        storagePath: blobPath,
        storageProvider: 'vercel',
        score: score.score,
        metadata: {
          width: image.width,
          height: image.height,
          photographer: image.photographer,
          alt: image.alt,
          compressedSize,
        },
      });
      console.log(`  ✓ Uploaded image ${image.id} to Vercel`);
    } catch (error) {
      console.error(`  ✗ Failed to upload image ${image.id} to Vercel:`, error);
    }
  }
  
  // Last 10 to Supabase
  console.log('  Uploading last 10 to Supabase...');
  for (let i = 40; i < Math.min(50, compressedImages.length); i++) {
    const { image, score, compressedPath, compressedSize } = compressedImages[i];
    const storagePath = `living-room-modern/img_${image.id}.jpg`;
    
    try {
      const url = await uploadToSupabase(compressedPath, storagePath);
      curatedImages.push({
        id: image.id,
        url,
        storagePath: storagePath,
        storageProvider: 'supabase',
        score: score.score,
        metadata: {
          width: image.width,
          height: image.height,
          photographer: image.photographer,
          alt: image.alt,
          compressedSize,
        },
      });
      console.log(`  ✓ Uploaded image ${image.id} to Supabase`);
    } catch (error) {
      console.error(`  ✗ Failed to upload image ${image.id} to Supabase:`, error);
    }
  }
  
  console.log(`✓ ${curatedImages.length} images uploaded\n`);

  // 6. Create curated JSON
  console.log('📄 Step 6: Creating curated JSON...');
  const curatedData = {
    category: 'living-room-modern',
    categoryAr: 'غرفة معيشة - مودرن',
    totalFetched: allImages.length,
    afterTextFilter: textFiltered.length,
    afterVisualFilter: topImages.length,
    finalCount: curatedImages.length,
    vercelCount: curatedImages.filter(img => img.storageProvider === 'vercel').length,
    supabaseCount: curatedImages.filter(img => img.storageProvider === 'supabase').length,
    images: curatedImages.sort((a, b) => b.score - a.score),
    generatedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    './curated-living-room-modern.json',
    JSON.stringify(curatedData, null, 2)
  );
  console.log('✓ Created curated-living-room-modern.json\n');

  // 7. Cleanup
  console.log('🧹 Step 7: Cleaning up temp files...');
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('✓ Temp files cleaned\n');
  } catch {
    console.log('⚠️  Could not clean temp files\n');
  }

  // Summary
  console.log('='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total fetched:              ${allImages.length} images`);
  console.log(`After text filtering:       ${textFiltered.length} images`);
  console.log(`After visual filtering:     ${topImages.length} images`);
  console.log(`Final curated:              ${curatedImages.length} images`);
  console.log(`  - Vercel Blob:            ${curatedData.vercelCount} images`);
  console.log(`  - Supabase Storage:       ${curatedData.supabaseCount} images`);
  console.log('='.repeat(60));
  console.log('\n✅ Test curation completed successfully!\n');
}

// Run the pipeline
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
