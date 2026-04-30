/**
 * Test Script for Omnipotent Agent
 * Demonstrates the 4 test commands specified in the requirements
 *
 * Usage: npx ts-node scripts/test-omnipotent-agent.ts
 */

import {
  discoverDatabaseSchema,
  getSystemOverview,
  generateSystemSnapshot,
  getTableSample,
} from "../lib/discovery-engine";
import { processQuery, generateExecutionPlan } from "../lib/general-agent";
import { runManualCheck } from "../lib/proactive-agent";

async function testCommand1() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 1: اكتشاف الجداول في قاعدة البيانات");
  console.log("السؤال: 'عايز تعرفلي إيه الجداول الموجودة في قاعدة البيانات؟'");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    const tables = await discoverDatabaseSchema();
    console.log("✅ تم اكتشاف الجداول بنجاح:");
    console.log(`   عدد الجداول: ${tables.length}`);
    tables.slice(0, 5).forEach((table) => {
      console.log(`   - ${table.name} (${table.columns.length} أعمدة, ${table.rowCount} صف)`);
    });
    if (tables.length > 5) {
      console.log(`   ... و ${tables.length - 5} جداول أخرى`);
    }
    return true;
  } catch (error) {
    console.error("❌ فشل الاختبار:", error);
    return false;
  }
}

async function testCommand2() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 2: عدد المستخدمين المسجلين");
  console.log("السؤال: 'كم عدد المستخدمين المسجلين؟'");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    const result = await processQuery("كم عدد المستخدمين المسجلين؟");
    console.log("✅ تم استلام الرد:");
    console.log(`   ${result.response}`);
    return result.success;
  } catch (error) {
    console.error("❌ فشل الاختبار:", error);
    return false;
  }
}

async function testCommand3() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 3: خطة لضغط الصور الكبيرة");
  console.log("السؤال: 'لاحظت أن صور غرف النوم كبيرة، اعمل لي خطة لضغطها'");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    const plan = await generateExecutionPlan(
      "لاحظت أن صور غرف النوم كبيرة، اعمل لي خطة لضغطها"
    );
    console.log("✅ تم إنشاء الخطة:");
    console.log(`   العنوان: ${plan.title}`);
    console.log(`   الوصف: ${plan.description}`);
    console.log(`   مستوى الخطر: ${plan.estimatedRisk}`);
    console.log(`   عدد الخطوات: ${plan.steps.length}`);
    plan.steps.forEach((step) => {
      console.log(`   - ${step.id}. ${step.description} [${step.action}]`);
    });
    return true;
  } catch (error) {
    console.error("❌ فشل الاختبار:", error);
    return false;
  }
}

async function testCommand4() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 4: اقتراحات تحسين الأتمتة");
  console.log("السؤال: 'اقترح تحسينات للأتمتة بناءً على آخر 7 أيام'");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    const findings = await runManualCheck("automation");
    console.log("✅ تم إنشاء ${findings.length} اقتراحات:");
    findings.forEach((finding, idx) => {
      console.log(`\n   ${idx + 1}. ${finding.title}`);
      console.log(`      النوع: ${finding.type} | الخطورة: ${finding.severity}`);
      console.log(`      الوصف: ${finding.description.substring(0, 100)}...`);
    });
    return findings.length > 0;
  } catch (error) {
    console.error("❌ فشل الاختبار:", error);
    return false;
  }
}

async function testSystemOverview() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("BONUS: نظرة عامة على النظام");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    const overview = await getSystemOverview();
    console.log("✅ تم إنشاء نظرة عامة:");
    console.log(overview);
    return true;
  } catch (error) {
    console.error("❌ فشل الاختبار:", error);
    return false;
  }
}

async function runAllTests() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║     اختبار الوكيل الشامل (Omnipotent Agent)                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  const results = {
    test1: await testCommand1(),
    test2: await testCommand2(),
    test3: await testCommand3(),
    test4: await testCommand4(),
    overview: await testSystemOverview(),
  };

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║                      نتائج الاختبارات                         ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log(`  اكتشاف الجداول: ${results.test1 ? "✅ نجح" : "❌ فشل"}`);
  console.log(`  عدد المستخدمين: ${results.test2 ? "✅ نجح" : "❌ فشل"}`);
  console.log(`  خطة ضغط الصور: ${results.test3 ? "✅ نجح" : "❌ فشل"}`);
  console.log(`  اقتراحات الأتمتة: ${results.test4 ? "✅ نجح" : "❌ فشل"}`);
  console.log(`  نظرة عامة: ${results.overview ? "✅ نجح" : "❌ فشل"}`);

  const allPassed = Object.values(results).every((r) => r);
  console.log(`\n${allPassed ? "🎉 جميع الاختبارات نجحت!" : "⚠️ بعض الاختبارات فشلت"}`);

  process.exit(allPassed ? 0 : 1);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

export { runAllTests };
