#!/usr/bin/env node
/**
 * Test Gemini API Keys Script
 * Tests 6 new Google Gemini API keys for validity
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const keys = [
  'AIzaSyBF4vC-AJtQDQIShLlVQntL8CUFrmfB6gs',
  'AIzaSyDwQeAvJhTXng5GpUBPWtSliwRlY91BqMc',
  'AIzaSyBO5FYxm19gI8Jw4TtD5fypSkQUBswburc',
  'AIzaSyA0M7f_dHNr-aJBrQyAJllrIetdmTBCBk',
  'AIzaSyDI82ZONLM9dxsvkJm9hlgYxSNAcwa3SvI',
  'AIzaSyAc1hKNXXtWKtZG_S1VXEWSXc5D8fBE3cg'
];

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
  console.log('\n🔑 Testing 6 Gemini API Keys\n');
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
