#!/usr/bin/env node
/**
 * Auto-Translation Script for Azenith Living
 * Uses Groq API to translate Arabic content to elegant English
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Parse Groq keys from environment
const parseKeyPool = (envValue) => {
  if (!envValue) return [];
  return envValue.split(',').map(k => k.trim()).filter(k => k.length > 0);
};

const GROQ_KEYS = parseKeyPool(process.env.GROQ_KEYS);
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

if (GROQ_KEYS.length === 0) {
  console.error('❌ No Groq API keys found in GROQ_KEYS environment variable');
  process.exit(1);
}

let keyIndex = 0;

// Get next key using round-robin
const getNextKey = () => {
  const key = GROQ_KEYS[keyIndex % GROQ_KEYS.length];
  keyIndex = (keyIndex + 1) % GROQ_KEYS.length;
  return key;
};

// Call Groq API for translation
async function translateWithGroq(text) {
  const key = getNextKey();
  
  const prompt = `Translate this Arabic luxury furniture brand text to elegant, sophisticated English suitable for a high-end interior design website. Maintain the premium tone and luxury brand voice similar to Four Seasons or Bvlgari.\n\nText: "${text}"\n\nReturn ONLY the English translation, no explanations, no quotation marks around the output.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Groq API error: ${response.status} - ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let translation = data.choices?.[0]?.message?.content?.trim() || '';
    
    // Remove surrounding quotes if present
    translation = translation.replace(/^["']|["']$/g, '');
    
    return translation;
  } catch (error) {
    console.error(`Translation failed: ${error.message}`);
    throw error;
  }
}

// Recursively translate object values
async function translateObject(obj, existingEn, path = '') {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    // Check if we already have a translation
    const existingValue = existingEn && getNestedValue(existingEn, currentPath);
    
    if (typeof value === 'object' && value !== null) {
      // Recursively translate nested objects
      const nestedExisting = existingValue || {};
      result[key] = await translateObject(value, nestedExisting, currentPath);
    } else if (typeof value === 'string') {
      // Skip if translation already exists and is different from original
      if (existingValue && typeof existingValue === 'string' && existingValue !== value && existingValue.length > 0) {
        console.log(`  ⏭️  Skipping (already translated): ${currentPath}`);
        result[key] = existingValue;
        continue;
      }
      
      // Skip if value is not Arabic (contains no Arabic characters)
      const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
      if (!arabicPattern.test(value)) {
        console.log(`  ⏭️  Skipping (not Arabic): ${currentPath}`);
        result[key] = existingValue || value;
        continue;
      }
      
      console.log(`  🔄 Translating: ${currentPath}`);
      try {
        const translation = await translateWithGroq(value);
        result[key] = translation;
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  ❌ Failed to translate ${currentPath}: ${error.message}`);
        // Use existing value or keep original on error
        result[key] = existingValue || value;
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// Get nested value from object using dot notation
function getNestedValue(obj, path) {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

// Main translation process
async function main() {
  console.log('🚀 Starting Azenith Living Translation Process\n');
  
  const messagesDir = path.join(__dirname, '..', 'messages');
  const arPath = path.join(messagesDir, 'ar.json');
  const enPath = path.join(messagesDir, 'en.json');
  
  // Read Arabic source
  console.log('📖 Reading Arabic source...');
  const arContent = JSON.parse(fs.readFileSync(arPath, 'utf8'));
  
  // Read existing English translations if available
  let existingEn = {};
  if (fs.existsSync(enPath)) {
    console.log('📖 Reading existing English translations...');
    existingEn = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  }
  
  // Translate
  console.log('\n🌐 Translating content...');
  const enContent = await translateObject(arContent, existingEn);
  
  // Write result
  console.log('\n💾 Saving translations...');
  fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2), 'utf8');
  
  console.log('\n✅ Translation complete!');
  console.log(`   Source: ${arPath}`);
  console.log(`   Output: ${enPath}`);
  
  // Count translations
  const countKeys = (obj) => {
    let count = 0;
    for (const value of Object.values(obj)) {
      if (typeof value === 'string') count++;
      else if (typeof value === 'object' && value !== null) count += countKeys(value);
    }
    return count;
  };
  
  console.log(`\n📊 Statistics:`);
  console.log(`   Total keys: ${countKeys(arContent)}`);
  console.log(`   Groq keys used: ${GROQ_KEYS.length}`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
