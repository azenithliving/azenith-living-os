import type { ClassifiedIntent } from "./admin-intent-types";

export interface AdminApprovalReport {
  title: string;
  actionLabel: string;
  userRequest: string;
  whereToSeeResult: string;
  whatWillHappen: string[];
  benefits: string[];
  risks: string[];
  safeguards: string[];
}

function actionLabelFor(intent: ClassifiedIntent): string {
  if (intent.kind === "command" && (intent.command === "evolve" || intent.commandLine?.startsWith("evolve"))) {
    return "مراجعة وتطوير آمن للموقع";
  }
  if (intent.kind === "command") return `تنفيذ أمر إداري: ${intent.commandLine || intent.command}`;
  if (intent.kind === "genesis") return "إنشاء/تكوين محتوى جديد عبر Genesis";
  if (intent.kind === "agents") return "مهمة فحص وتحليل بواسطة الوكلاء";
  if (intent.kind === "ultimate_tool") return `تشغيل أداة: ${intent.toolName}`;
  return "إجراء إداري";
}

function resultLocationFor(intent: ClassifiedIntent): string {
  if (intent.kind === "command" && (intent.command === "evolve" || intent.commandLine?.startsWith("evolve"))) {
    return "ستظهر نتيجة الفحص أو الاقتراح داخل محادثة المساعد وداخل دفتر الأدلة. لو نتج عنه تعديل كود، سيظهر كطلب موافقة منفصل قبل تطبيقه.";
  }
  if (intent.kind === "genesis") {
    return "ستظهر نتيجة Genesis في محادثة المساعد، وأي تعديل فعلي سيظهر في دفتر الأدلة وسجل الموافقات.";
  }
  if (intent.kind === "agents") {
    return "ستظهر نتيجة المهمة في محادثة المساعد، وسجل التنفيذ، ودفتر الأدلة.";
  }
  return "ستظهر النتيجة في محادثة المساعد ودفتر الأدلة بعد التنفيذ.";
}

function whatWillHappenFor(intent: ClassifiedIntent, request: string): string[] {
  if (intent.kind === "command" && (intent.command === "evolve" || intent.commandLine?.startsWith("evolve"))) {
    return [
      "سيفحص الطلب ويبحث عن تحسينات محتملة مرتبطة به.",
      "سيحاول اقتراح إصلاح أو خطة تطوير بدل تنفيذ تعديل عشوائي.",
      "لن يطبق أي تعديل كود أو تغيير حساس إلا بطلب موافقة منفصل وواضح.",
    ];
  }
  if (intent.kind === "genesis") {
    return [
      "سيحوّل طلبك إلى خطة إنشاء/تعديل محتوى.",
      "سيجهز النتيجة المقترحة ويعرضها عليك.",
      "لن ينشر أو يغير الصفحة مباشرة إلا بعد موافقة واضحة.",
    ];
  }
  if (intent.kind === "agents") {
    return [
      "سيشغل مهمة تحليل منظمة بناء على طلبك.",
      "سيجمع النتائج ويرتبها كتقرير قابل للمراجعة.",
      "أي إجراء تغييري لاحق سيحتاج موافقة منفصلة.",
    ];
  }
  return [`سيحاول تنفيذ الطلب التالي بطريقة آمنة: ${request.slice(0, 220)}`];
}

export function buildAdminApprovalReport(intent: ClassifiedIntent, userRequest: string): AdminApprovalReport {
  const actionLabel = actionLabelFor(intent);
  return {
    title: "تقرير قرار قبل الموافقة",
    actionLabel,
    userRequest,
    whereToSeeResult: resultLocationFor(intent),
    whatWillHappen: whatWillHappenFor(intent, userRequest),
    benefits: [
      "يعطيك نتيجة قابلة للمراجعة بدل تنفيذ صامت.",
      "يسجل العملية في دفتر الأدلة حتى يمكن تتبع ما حدث.",
      "يفصل بين الفحص/الاقتراح وبين أي تغيير فعلي حساس.",
    ],
    risks: [
      "قد ينتج عنه اقتراح غير كاف إذا كان الطلب واسعاً أو الرابط غير قابل للقراءة.",
      "قد يحتاج وقتاً أطول لو تطلب فحص صفحات أو خدمات خارجية.",
      "أي تنفيذ لاحق لتعديل فعلي قد يؤثر على المحتوى أو الكود لذلك سيحتاج موافقة منفصلة.",
    ],
    safeguards: [
      "لن يتم تنفيذ تغيير حساس قبل موافقتك.",
      "سيتم تسجيل النتيجة في محادثة المساعد ودفتر الأدلة.",
      "يمكنك رفض الطلب من لوحة عقل النظام بدون أي أثر تنفيذي.",
    ],
  };
}

export function formatApprovalReportForChat(report: AdminApprovalReport): string {
  return [
    `🛡️ **${report.title}**`,
    `**الإجراء المقترح:** ${report.actionLabel}`,
    `**طلبك:** ${report.userRequest}`,
    `**أين ستظهر النتيجة؟** ${report.whereToSeeResult}`,
    "",
    "**ما الذي سيحدث؟**",
    ...report.whatWillHappen.map((item) => `- ${item}`),
    "",
    "**الفوائد:**",
    ...report.benefits.map((item) => `- ${item}`),
    "",
    "**المخاطر/الحدود:**",
    ...report.risks.map((item) => `- ${item}`),
    "",
    "**ضمانات الأمان:**",
    ...report.safeguards.map((item) => `- ${item}`),
    "",
    "راجع لوحة «عقل النظام» واضغط موافقة أو رفض.",
  ].join("\n");
}
