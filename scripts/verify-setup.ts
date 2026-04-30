#!/usr/bin/env tsx
/**
 * Verification Script - Azenith Living System Check
 * Tests all critical components and API keys
 */

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Colors for output
const colors = {
  success: '\x1b[32m✓\x1b[0m',
  error: '\x1b[31m✗\x1b[0m',
  warning: '\x1b[33m⚠\x1b[0m',
  info: '\x1b[36mℹ\x1b[0m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

function log(status: 'success' | 'error' | 'warning' | 'info', message: string) {
  const icon = colors[status];
  console.log(`${icon} ${message}`);
}

async function checkEnvVariables() {
  console.log('\n' + colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(colors.bold + '  1. فحص متغيرات البيئة (.env.local)' + colors.reset);
  console.log(colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
    'GROQ_KEYS',
    'WHATSAPP_DEFAULT_NUMBER',
    'TELEGRAM_BOT_TOKEN',
    'DATABASE_URL'
  ];

  const results: Record<string, boolean> = {};

  for (const key of required) {
    const value = process.env[key];
    const isSet = !!value && value.length > 10;
    results[key] = isSet;
    
    if (isSet) {
      const masked = value!.substring(0, 8) + '...' + value!.substring(value!.length - 4);
      log('success', `${key}: ${masked} (${value!.length} chars)`);
    } else {
      log('error', `${key}: غير موجود أو فارغ!`);
    }
  }

  const allSet = Object.values(results).every(v => v);
  return { success: allSet, results };
}

async function checkSupabaseConnection() {
  console.log('\n' + colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(colors.bold + '  2. اختبار اتصال Supabase' + colors.reset);
  console.log(colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      log('error', 'مفاتيح Supabase غير موجودة!');
      return { success: false, tables: [] };
    }

    const supabase = createClient(url, key);

    // Test connection
    const { data, error } = await supabase.from('events').select('count', { count: 'exact', head: true });
    
    if (error) {
      log('error', `خطأ في الاتصال: ${error.message}`);
      return { success: false, tables: [] };
    }

    log('success', `✅ الاتصال بـ Supabase ناجح!`);
    log('info', `   URL: ${url}`);

    // Check tables
    const criticalTables = [
      'events', 'rooms', 'bookings', 'users', 'companies',
      'agent_memory', 'agent_goals', 'swarm_keys', 'system_snapshots'
    ];

    const existingTables: string[] = [];

    for (const table of criticalTables) {
      try {
        const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' });
        if (!error || error.code === 'PGRST116') { // Permission error means table exists
          log('success', `جدول ${table}: موجود ✓`);
          existingTables.push(table);
        } else if (error.code === '42P01') {
          log('error', `جدول ${table}: غير موجود ✗`);
        } else {
          log('warning', `جدول ${table}: ? (${error.code})`);
        }
      } catch {
        log('warning', `جدول ${table}: تعذر الفحص`);
      }
    }

    return { success: true, tables: existingTables };
  } catch (err) {
    log('error', `فشل الاتصال: ${err}`);
    return { success: false, tables: [] };
  }
}

async function checkGeminiAPI() {
  console.log('\n' + colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(colors.bold + '  3. اختبار Gemini API' + colors.reset);
  console.log(colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    log('error', 'مفتاح Gemini غير موجود!');
    return { success: false };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "API test successful" in Arabic' }] }]
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      log('error', `فشل الاختبار: ${response.status} - ${error.substring(0, 100)}`);
      return { success: false };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    log('success', `✅ Gemini API يعمل!`);
    log('info', `   الرد: ${text.substring(0, 50)}...`);
    return { success: true };
  } catch (err) {
    log('error', `خطأ: ${err}`);
    return { success: false };
  }
}

async function checkGroqAPI() {
  console.log('\n' + colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(colors.bold + '  4. اختبار Groq API' + colors.reset);
  console.log(colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');

  const keys = process.env.GROQ_KEYS?.split(',') || [];
  if (keys.length === 0) {
    log('error', 'لا توجد مفاتيح Groq!');
    return { success: false, workingKeys: 0 };
  }

  log('info', `عدد المفاتيح: ${keys.length}`);

  let workingKeys = 0;
  const testedKeys: string[] = [];

  for (let i = 0; i < Math.min(keys.length, 3); i++) {
    const key = keys[i].trim();
    const masked = key.substring(0, 8) + '...';

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Say hi' }],
          max_tokens: 10
        })
      });

      if (response.ok) {
        log('success', `مفتاح ${i + 1} (${masked}): ✅ شغال`);
        workingKeys++;
        testedKeys.push(key);
      } else {
        const error = await response.text();
        log('error', `مفتاح ${i + 1} (${masked}): ✗ ${response.status}`);
        if (error.includes('quota')) {
          log('warning', '   → نفد الرصيد!');
        }
      }
    } catch (err) {
      log('error', `مفتاح ${i + 1}: خطأ في الاتصال`);
    }
  }

  if (workingKeys > 0) {
    log('success', `✅ ${workingKeys}/${Math.min(keys.length, 3)} مفاتيح شغالة`);
  } else {
    log('error', `✗ جميع المفاتيح لا تعمل!`);
  }

  return { success: workingKeys > 0, workingKeys };
}

async function checkDeepSeekAPI() {
  console.log('\n' + colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(colors.bold + '  5. اختبار DeepSeek API' + colors.reset);
  console.log(colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');

  const keys = process.env.DEEPSEEK_KEYS?.split(',') || [];
  if (keys.length === 0) {
    log('error', 'لا توجد مفاتيح DeepSeek!');
    return { success: false, workingKeys: 0 };
  }

  log('info', `عدد المفاتيح: ${keys.length}`);

  let workingKeys = 0;

  for (let i = 0; i < Math.min(keys.length, 2); i++) {
    const key = keys[i].trim();
    const masked = key.substring(0, 8) + '...';

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10
        })
      });

      if (response.ok) {
        log('success', `مفتاح ${i + 1} (${masked}): ✅ شغال`);
        workingKeys++;
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `${response.status}`;
        log('error', `مفتاح ${i + 1} (${masked}): ✗ ${errorMsg.substring(0, 50)}`);
      }
    } catch (err) {
      log('error', `مفتاح ${i + 1}: خطأ في الاتصال`);
    }
  }

  return { success: workingKeys > 0, workingKeys };
}

async function checkDatabaseConnection() {
  console.log('\n' + colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(colors.bold + '  6. اختبار Prisma/Database' + colors.reset);
  console.log(colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');

  try {
    // Test connection
    await prisma.$connect();
    log('success', '✅ الاتصال بقاعدة البيانات ناجح!');

    // Check some tables
    const tables = ['User', 'Room', 'Booking', 'Event'];
    const counts: Record<string, number> = {};

    for (const table of tables) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const count = await (prisma as any)[table.toLowerCase()]?.count?.() || 0;
        counts[table] = count;
        log('info', `جدول ${table}: ${count} صفوف`);
      } catch {
        log('warning', `جدول ${table}: تعذر العد`);
      }
    }

    await prisma.$disconnect();
    return { success: true, counts };
  } catch (err) {
    log('error', `فشل الاتصال: ${err}`);
    return { success: false, counts: {} };
  }
}

async function checkTelegram() {
  console.log('\n' + colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(colors.bold + '  7. اختبار Telegram' + colors.reset);
  console.log(colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    log('error', 'مفاتيح Telegram غير موجودة!');
    return { success: false };
  }

  try {
    // Just check if bot is valid
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();

    if (data.ok) {
      log('success', `✅ Telegram Bot شغال!`);
      log('info', `   البوت: @${data.result.username}`);
      return { success: true };
    } else {
      log('error', `فشل: ${data.description}`);
      return { success: false };
    }
  } catch (err) {
    log('error', `خطأ: ${err}`);
    return { success: false };
  }
}

// Main
async function main() {
  console.log('\n');
  console.log(colors.bold + '╔══════════════════════════════════════════════════════════════╗' + colors.reset);
  console.log(colors.bold + '║                                                              ║' + colors.reset);
  console.log(colors.bold + '║       🔍 فحص شامل لنظام Azenith Living                      ║' + colors.reset);
  console.log(colors.bold + '║                                                              ║' + colors.reset);
  console.log(colors.bold + '╚══════════════════════════════════════════════════════════════╝' + colors.reset);

  const results = {
    env: await checkEnvVariables(),
    supabase: await checkSupabaseConnection(),
    gemini: await checkGeminiAPI(),
    groq: await checkGroqAPI(),
    deepseek: await checkDeepSeekAPI(),
    database: await checkDatabaseConnection(),
    telegram: await checkTelegram()
  };

  // Summary
  console.log('\n' + colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(colors.bold + '  📊 ملخص النتائج' + colors.reset);
  console.log(colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');

  const summary = [
    { name: 'متغيرات البيئة', status: results.env.success },
    { name: 'اتصال Supabase', status: results.supabase.success },
    { name: 'Gemini API', status: results.gemini.success },
    { name: 'Groq API', status: results.groq.success },
    { name: 'DeepSeek API', status: results.deepseek.success },
    { name: 'قاعدة البيانات', status: results.database.success },
    { name: 'Telegram', status: results.telegram.success }
  ];

  let passed = 0;
  for (const item of summary) {
    if (item.status) {
      console.log(`  ${colors.success} ${item.name}`);
      passed++;
    } else {
      console.log(`  ${colors.error} ${item.name}`);
    }
  }

  const percentage = Math.round((passed / summary.length) * 100);

  console.log('\n' + colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(`  النتيجة: ${passed}/${summary.length} (${percentage}%)`);
  console.log(colors.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');

  if (percentage >= 80) {
    console.log(colors.success + ' ✅ النظام جاهز للعمل! يمكنك البدء في استخدام الموقع.');
  } else if (percentage >= 50) {
    console.log(colors.warning + ' ⚠️ النظام جزئياً جاهز. بعض الميزات قد لا تعمل.');
  } else {
    console.log(colors.error + ' ✗ النظام غير جاهز. تحتاج إصلاحات قبل التشغيل.');
  }

  console.log('\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
