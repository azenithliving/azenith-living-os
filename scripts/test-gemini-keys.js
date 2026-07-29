#!/usr/bin/env node
/**
 * Test Gemini API Keys Script
 * Tests 6 new Google Gemini API keys for validity
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const keys = [
  ...(process.env.GOOGLE_AI_KEYS || "").split(","),
  ...(process.env.GEMINI_API_KEY || "").split(","),
].map((key) => key.trim()).filter(Boolean);

async function testKey(key, index) {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent('What is 2+2?');
    const response = result.response.text();
    
    console.log(`✅ المفتاح ${index + 1} يعمل: ${key.slice(0, 15)}...`);
    console.log(`   الرد: ${response.trim().slice(0, 50)}...`);
    return true;
  } catch (error) {
    console.log(`❌ المفتاح ${index + 1} فشل: ${key.slice(0, 15)}...`);
    console.log(`   الخطأ: ${error.message || error}`);
    return false;
  }
}

async function main() {
  console.log(`\nTesting ${keys.length} Gemini API key(s)\n`);
  console.log('='.repeat(50));
  
  let validCount = 0;
  let invalidCount = 0;
  
  for (let i = 0; i < keys.length; i++) {
    const isValid = await testKey(keys[i], i);
    if (isValid) validCount++;
    else invalidCount++;
    
    // Small delay between requests
    if (i < keys.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('='.repeat(50));
  console.log('\n📊 ملخص النتائج:');
  console.log(`   ✅ مفاتيح صالحة: ${validCount}`);
  console.log(`   ❌ مفاتيح فاشلة: ${invalidCount}`);
  console.log(`   المجموع: ${keys.length}`);
  console.log('\n');
}

main().catch(console.error);
