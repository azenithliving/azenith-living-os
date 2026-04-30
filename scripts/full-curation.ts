#!/usr/bin/env ts-node
/**
 * Azenith Full Curation Script v1.0
 * Complete image curation pipeline for all rooms and styles
 * 
 * Features:
 * - Fetches 500 images per room+style combination from Pexels
 * - Text filtering using askGroq (initial filtering)
 * - Vision scoring using askOpenRouter (Claude 3.5 Sonnet)
 * - Selects top 50 images per combination
 * - Uploads to Supabase Storage (curated/[room]/[style]/)
 * - Generates curated-images.json with all metadata
 * - Key rotation for all APIs to avoid rate limits
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Target rooms and styles
  ROOMS: [
    { id: 'living-room', name: 'غرفة المعيشة', query: 'luxury living room interior design' },
    { id: 'bedroom', name: 'غرفة النوم', query: 'luxury bedroom interior design' },
    { id: 'dining-room', name: 'غرفة الطعام', query: 'luxury dining room interior design' },
    { id: 'kitchen', name: 'المطبخ', query: 'luxury kitchen interior design' },
    { id: 'bathroom', name: 'الحمام', query: 'luxury bathroom interior design' },
    { id: 'office', name: 'المكتب', query: 'luxury home office interior design' },
    { id: 'kids-room', name: 'غرفة الأطفال', query: 'luxury kids bedroom interior design' },
  ],
  
  STYLES: [
    { id: 'modern', name: 'مودرن', query: 'modern minimal contemporary' },
    { id: 'classic', name: 'كلاسيك', query: 'classic elegant traditional' },
    { id: 'industrial', name: 'صناعي', query: 'industrial loft rustic' },
    { id: 'scandinavian', name: 'اسكندنافي', query: 'scandinavian nordic cozy' },
  ],
  
  // Curation settings
  IMAGES_TO_FETCH: 500,        // Images to fetch per combination
  IMAGES_TO_KEEP: 100,         // Top images to keep after filtering
  PEXELS_PER_PAGE: 80,         // Max per Pexels request
  
  // Scoring thresholds
  MIN_VISION_SCORE: 6,         // Minimum score to keep (1-10)
  TOP_TIER_THRESHOLD: 8,       // Score for "elite" tier
  
  // Rate limiting (ms)
  PEXELS_DELAY: 200,
  GROQ_DELAY: 100,
  OPENROUTER_DELAY: 500,
  UPLOAD_DELAY: 100,
  
  // Storage
  STORAGE_BUCKET: 'curated-images',
  OUTPUT_JSON: 'curated-images.json',
  TEMP_DIR: './temp-curation',
};

// ============================================
// TYPES
// ============================================

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
  };
  alt: string;
  photographer: string;
  avg_color: string;
}

interface CuratedImage {
  id: number;
  pexelsId: number;
  room: string;
  style: string;
  url: string;
  storagePath: string;
  storageUrl: string;
  scores: {
    groqRelevance: boolean;
    visionScore: number;
    visionReason: string;
  };
  metadata: {
    width: number;
    height: number;
    photographer: string;
    alt: string;
    avgColor: string;
    fileSize: number;
  };
  curatedAt: string;
}

interface CurationResult {
  room: string;
  style: string;
  fetched: number;
  groqPassed: number;
  visionScored: number;
  finalSelected: number;
  images: CuratedImage[];
}

// ============================================
// KEY ROTATION SYSTEM
// ============================================

class KeyRotator {
  private keys: string[];
  private currentIndex: number = 0;
  private name: string;

  constructor(envVar: string, name: string) {
    const value = process.env[envVar] || '';
    this.keys = value.split(',').map(k => k.trim()).filter(Boolean);
    this.name = name;
    
    if (this.keys.length === 0) {
      throw new Error(`[KeyRotator] No keys found for ${envVar}`);
    }
    console.log(`[KeyRotator] ${name}: Loaded ${this.keys.length} keys`);
  }

  getNext(): string {
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  getStats() {
    return {
      name: this.name,
      total: this.keys.length,
      currentIndex: this.currentIndex,
    };
  }
}

// Initialize key rotators
const pexelsRotator = new KeyRotator('PEXELS_KEYS', 'Pexels');
const groqRotator = new KeyRotator('GROQ_KEYS', 'Groq');
const openRouterRotator = new KeyRotator('OPENROUTER_KEYS', 'OpenRouter');

// ============================================
// SUPABASE CLIENT
// ============================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================
// PEXELS FETCHING
// ============================================

async function fetchFromPexels(
  roomQuery: string,
  styleQuery: string,
  targetCount: number
): Promise<PexelsImage[]> {
  const allImages: PexelsImage[] = [];
  const seenIds = new Set<number>();
  
  const fullQuery = `${styleQuery} ${roomQuery}`;
  const pagesNeeded = Math.ceil(targetCount / CONFIG.PEXELS_PER_PAGE);
  
  console.log(`[Pexels] Fetching ${targetCount} images for query: "${fullQuery}"`);
  
  for (let page = 1; page <= pagesNeeded; page++) {
    const apiKey = pexelsRotator.getNext();
    
    try {
      const response = await axios.get('https://api.pexels.com/v1/search', {
        headers: { Authorization: apiKey },
        params: {
          query: fullQuery,
          page,
          per_page: CONFIG.PEXELS_PER_PAGE,
          orientation: 'all',
        },
        timeout: 30000,
      });

      const photos: PexelsImage[] = response.data.photos || [];
      
      for (const photo of photos) {
        if (!seenIds.has(photo.id)) {
          seenIds.add(photo.id);
          allImages.push(photo);
        }
      }
      
      console.log(`[Pexels] Page ${page}: ${photos.length} images (total: ${allImages.length})`);
      
      // Rate limiting
      await sleep(CONFIG.PEXELS_DELAY);
      
      // Stop if we have enough
      if (allImages.length >= targetCount) break;
      
    } catch (error) {
      console.error(`[Pexels] Error on page ${page}:`, (error as Error).message);
      await sleep(CONFIG.PEXELS_DELAY * 5); // Longer delay on error
    }
  }
  
  return allImages.slice(0, targetCount);
}

// ============================================
// GROQ TEXT FILTERING
// ============================================

async function filterWithGroq(
  images: PexelsImage[],
  roomName: string,
  styleName: string
): Promise<PexelsImage[]> {
  const passed: PexelsImage[] = [];
  
  console.log(`[Groq] Filtering ${images.length} images for ${roomName} - ${styleName}`);
  
  for (const image of images) {
    const apiKey = groqRotator.getNext();
    
    const prompt = `Analyze if this image shows a "${styleName} ${roomName}" interior design.

Image description: ${image.alt || 'No description'}
Photographer: ${image.photographer}

Answer with ONLY "YES" or "NO". Is this a suitable ${styleName} ${roomName} interior image?`;

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are an interior design expert. Answer only YES or NO.' },
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
      const isRelevant = answer.includes('yes') || answer.includes('نعم');
      
      if (isRelevant) {
        passed.push(image);
      }
      
      if (passed.length % 10 === 0) {
        console.log(`[Groq] ${passed.length}/${images.length} passed...`);
      }
      
      await sleep(CONFIG.GROQ_DELAY);
      
    } catch (error) {
      console.error(`[Groq] Error filtering image ${image.id}:`, (error as Error).message);
      // Include on error to not lose images
      passed.push(image);
    }
  }
  
  console.log(`[Groq] Filtered: ${passed.length}/${images.length} passed`);
  return passed;
}

// ============================================
// OPENROUTER VISION SCORING (Claude 3.5 Sonnet)
// ============================================

interface VisionScore {
  score: number;
  reason: string;
}

async function scoreWithVision(
  image: PexelsImage,
  roomName: string,
  styleName: string
): Promise<VisionScore | null> {
  const apiKey = openRouterRotator.getNext();
  
  try {
    // Download image for vision analysis
    const imageResponse = await axios.get(image.src.large, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    const base64Image = Buffer.from(imageResponse.data).toString('base64');
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Rate this ${styleName} ${roomName} interior design image from 1-10 based on:
- Design quality and aesthetics
- Authenticity to ${styleName} style
- Professional photography quality
- Suitability for luxury interior design showcase

Return ONLY a JSON object: {"score": number, "reason": "brief reason"}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.PRIMARY_DOMAIN || 'https://azenithliving.com',
          'X-Title': 'Azenith Living Curation',
        },
        timeout: 60000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    const parsed: VisionScore = JSON.parse(content);
    
    return {
      score: Math.min(10, Math.max(1, Math.round(parsed.score))),
      reason: parsed.reason || 'No reason provided',
    };
    
  } catch (error) {
    console.error(`[Vision] Error scoring image ${image.id}:`, (error as Error).message);
    return null;
  }
}

async function scoreImagesWithVision(
  images: PexelsImage[],
  roomName: string,
  styleName: string
): Promise<Array<{ image: PexelsImage; score: VisionScore }>> {
  const scored: Array<{ image: PexelsImage; score: VisionScore }> = [];
  
  console.log(`[Vision] Scoring ${images.length} images with Claude Vision...`);
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const visionScore = await scoreWithVision(image, roomName, styleName);
    
    if (visionScore && visionScore.score >= CONFIG.MIN_VISION_SCORE) {
      scored.push({ image, score: visionScore });
    }
    
    if ((i + 1) % 5 === 0) {
      console.log(`[Vision] Scored ${i + 1}/${images.length}... (${scored.length} kept)`);
    }
    
    await sleep(CONFIG.OPENROUTER_DELAY);
  }
  
  // Sort by score descending
  scored.sort((a, b) => b.score.score - a.score.score);
  
  console.log(`[Vision] Scored: ${scored.length}/${images.length} met threshold (${CONFIG.MIN_VISION_SCORE}+)`);
  return scored;
}

// ============================================
// IMAGE PROCESSING & UPLOAD
// ============================================

async function processAndUploadImage(
  image: PexelsImage,
  room: string,
  style: string,
  score: VisionScore
): Promise<CuratedImage | null> {
  try {
    // Create temp directory if needed
    if (!fs.existsSync(CONFIG.TEMP_DIR)) {
      fs.mkdirSync(CONFIG.TEMP_DIR, { recursive: true });
    }
    
    // Download image
    const response = await axios.get(image.src.large, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    const originalBuffer = Buffer.from(response.data);
    
    // Process with sharp
    const processedBuffer = await sharp(originalBuffer)
      .resize(1600, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    
    const tempPath = path.join(CONFIG.TEMP_DIR, `${image.id}.jpg`);
    fs.writeFileSync(tempPath, processedBuffer);
    
    // Upload to Supabase Storage
    const storagePath = `curated/${room}/${style}/${image.id}.jpg`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(CONFIG.STORAGE_BUCKET)
      .upload(storagePath, processedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(CONFIG.STORAGE_BUCKET)
      .getPublicUrl(storagePath);
    
    // Clean up temp file
    fs.unlinkSync(tempPath);
    
    // Create curated image record
    const curatedImage: CuratedImage = {
      id: Date.now() + Math.random(),
      pexelsId: image.id,
      room,
      style,
      url: image.src.large,
      storagePath,
      storageUrl: urlData.publicUrl,
      scores: {
        groqRelevance: true,
        visionScore: score.score,
        visionReason: score.reason,
      },
      metadata: {
        width: image.width,
        height: image.height,
        photographer: image.photographer,
        alt: image.alt,
        avgColor: image.avg_color,
        fileSize: processedBuffer.length,
      },
      curatedAt: new Date().toISOString(),
    };
    
    await sleep(CONFIG.UPLOAD_DELAY);
    
    return curatedImage;
    
  } catch (error) {
    console.error(`[Upload] Error processing image ${image.id}:`, (error as Error).message);
    return null;
  }
}

// ============================================
// CURATION PIPELINE FOR ONE COMBINATION
// ============================================

async function curateCombination(
  room: typeof CONFIG.ROOMS[0],
  style: typeof CONFIG.STYLES[0],
  testMode: boolean = false
): Promise<CurationResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Starting curation: ${room.name} - ${style.name}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const startTime = Date.now();
  
  // Step 1: Fetch from Pexels
  const fetchedImages = await fetchFromPexels(
    room.query,
    style.query,
    testMode ? 50 : CONFIG.IMAGES_TO_FETCH
  );
  
  if (fetchedImages.length === 0) {
    return {
      room: room.id,
      style: style.id,
      fetched: 0,
      groqPassed: 0,
      visionScored: 0,
      finalSelected: 0,
      images: [],
    };
  }
  
  // Step 2: Groq text filtering
  const groqPassed = await filterWithGroq(fetchedImages, room.name, style.name);
  
  // In test mode, skip vision scoring for speed
  let visionScored: Array<{ image: PexelsImage; score: VisionScore }> = [];
  
  if (testMode) {
    // Simulate scoring with random high scores for test mode
    visionScored = groqPassed.slice(0, 10).map(img => ({
      image: img,
      score: { score: 8, reason: 'Test mode - simulated high score' },
    }));
  } else {
    visionScored = await scoreImagesWithVision(groqPassed, room.name, style.name);
  }
  
  // Step 3: Select top images
  const topImages = visionScored.slice(0, testMode ? 5 : CONFIG.IMAGES_TO_KEEP);
  
  // Step 4: Process and upload
  const curatedImages: CuratedImage[] = [];
  
  console.log(`\n[Upload] Processing ${topImages.length} top images...`);
  
  for (let i = 0; i < topImages.length; i++) {
    const { image, score } = topImages[i];
    console.log(`[Upload] ${i + 1}/${topImages.length}: Image ${image.id} (score: ${score.score})`);
    
    const curated = await processAndUploadImage(image, room.id, style.id, score);
    if (curated) {
      curatedImages.push(curated);
      console.log(`  ✓ Uploaded: ${curated.storageUrl}`);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Completed: ${room.name} - ${style.name}`);
  console.log(`  Fetched: ${fetchedImages.length}`);
  console.log(`  Groq passed: ${groqPassed.length}`);
  console.log(`  Vision scored: ${visionScored.length}`);
  console.log(`  Final uploaded: ${curatedImages.length}`);
  console.log(`  Duration: ${duration} minutes`);
  console.log(`${'='.repeat(60)}\n`);
  
  return {
    room: room.id,
    style: style.id,
    fetched: fetchedImages.length,
    groqPassed: groqPassed.length,
    visionScored: visionScored.length,
    finalSelected: curatedImages.length,
    images: curatedImages,
  };
}

// ============================================
// MAIN EXECUTION
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(70));
  console.log('  AZENITH FULL IMAGE CURATION SYSTEM');
  console.log('  Building the perfect image library...');
  console.log('='.repeat(70) + '\n');
  
  // Check environment
  console.log('[Setup] Checking environment...');
  console.log(`  Pexels keys: ${pexelsRotator.getStats().total}`);
  console.log(`  Groq keys: ${groqRotator.getStats().total}`);
  console.log(`  OpenRouter keys: ${openRouterRotator.getStats().total}`);
  console.log(`  Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗'}`);
  
  // Check if test mode
  const testMode = process.argv.includes('--test') || process.argv.includes('-t');
  const testCombination = process.argv.includes('--living-room-modern');
  
  if (testMode) {
    console.log('\n[MODE] TEST MODE - Limited processing for quick validation');
  }
  
  if (testCombination) {
    console.log('\n[MODE] Testing single combination: living-room + modern');
  }
  
  // Determine combinations to process
  let combinations: Array<{ room: typeof CONFIG.ROOMS[0]; style: typeof CONFIG.STYLES[0] }> = [];
  
  if (testCombination) {
    const room = CONFIG.ROOMS.find(r => r.id === 'living-room')!;
    const style = CONFIG.STYLES.find(s => s.id === 'modern')!;
    combinations = [{ room, style }];
  } else {
    for (const room of CONFIG.ROOMS) {
      for (const style of CONFIG.STYLES) {
        combinations.push({ room, style });
      }
    }
  }
  
  console.log(`\n[Plan] Processing ${combinations.length} combinations:`);
  combinations.forEach(({ room, style }) => {
    console.log(`  - ${room.name} (${style.name})`);
  });
  
  // Process all combinations
  const allResults: CurationResult[] = [];
  
  for (let i = 0; i < combinations.length; i++) {
    const { room, style } = combinations[i];
    console.log(`\n[Progress] ${i + 1}/${combinations.length}`);
    
    const result = await curateCombination(room, style, testMode);
    allResults.push(result);
    
    // Save intermediate results
    const progressData = {
      completed: i + 1,
      total: combinations.length,
      results: allResults,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync('curation-progress.json', JSON.stringify(progressData, null, 2));
  }
  
  // Generate final summary
  const totalImages = allResults.reduce((sum, r) => sum + r.finalSelected, 0);
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n' + '='.repeat(70));
  console.log('  CURATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`  Total combinations: ${allResults.length}`);
  console.log(`  Total images curated: ${totalImages}`);
  console.log(`  Total duration: ${duration} minutes`);
  console.log('='.repeat(70) + '\n');
  
  // Generate final JSON
  const finalOutput = {
    generatedAt: new Date().toISOString(),
    totalCombinations: allResults.length,
    totalImages: totalImages,
    combinations: allResults.map(r => ({
      room: r.room,
      style: r.style,
      count: r.finalSelected,
      stats: {
        fetched: r.fetched,
        groqPassed: r.groqPassed,
        visionScored: r.visionScored,
      },
    })),
    images: allResults.flatMap(r => r.images),
  };
  
  fs.writeFileSync(CONFIG.OUTPUT_JSON, JSON.stringify(finalOutput, null, 2));
  console.log(`[Output] Saved to ${CONFIG.OUTPUT_JSON}`);
  
  // Cleanup
  if (fs.existsSync(CONFIG.TEMP_DIR)) {
    fs.rmSync(CONFIG.TEMP_DIR, { recursive: true });
    console.log('[Cleanup] Removed temp directory');
  }
  
  console.log('\n✓ Full curation complete!\n');
}

// Run with error handling
main().catch(error => {
  console.error('\n[ERROR] Curation failed:', error);
  process.exit(1);
});
