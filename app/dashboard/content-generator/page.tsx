"use client";

import { useState } from "react";

type ContentType = "page_title" | "page_description" | "cta_text" | "product_description";

export default function ContentGeneratorPage() {
  const [contentType, setContentType] = useState<ContentType>("page_title");
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [context, setContext] = useState({
    roomType: "غرفة معيشة",
    style: "حديث",
    budget: "100,000 ريال",
    brandName: "أزينث"
  });

  const generateContent = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/content-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: contentType,
          context,
          language: "ar"
        })
      });

      const data = await response.json();
      if (data.ok && data.content) {
        setGeneratedContent(data.content);
      }
    } catch (error) {
      console.error("Failed to generate content:", error);
    } finally {
      setGenerating(false);
    }
  };

  const improveContent = async (improvement: "seo" | "clarity" | "persuasion") => {
    if (!generatedContent) return;

    setGenerating(true);
    try {
      const response = await fetch("/api/content-generator/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: generatedContent,
          improvement
        })
      });

      const data = await response.json();
      if (data.ok && data.content) {
        setGeneratedContent(data.content);
      }
    } catch (error) {
      console.error("Failed to improve content:", error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">AI Content Generator</p>
          <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">منشئ المحتوى الذكي</h1>
        </div>

        {/* Configuration */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">تكوين السياق</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="context-roomtype" className="block text-sm font-medium text-white/70 mb-2">نوع الغرفة</label>
              <input
                id="context-roomtype"
                type="text"
                value={context.roomType}
                onChange={(e) => setContext({ ...context, roomType: e.target.value })}
                className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
              />
            </div>

            <div>
              <label htmlFor="context-style" className="block text-sm font-medium text-white/70 mb-2">الأسلوب</label>
              <input
                id="context-style"
                type="text"
                value={context.style}
                onChange={(e) => setContext({ ...context, style: e.target.value })}
                className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
              />
            </div>

            <div>
              <label htmlFor="context-budget" className="block text-sm font-medium text-white/70 mb-2">الميزانية</label>
              <input
                id="context-budget"
                type="text"
                value={context.budget}
                onChange={(e) => setContext({ ...context, budget: e.target.value })}
                className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
              />
            </div>

            <div>
              <label htmlFor="context-brandname" className="block text-sm font-medium text-white/70 mb-2">اسم العلامة التجارية</label>
              <input
                id="context-brandname"
                type="text"
                value={context.brandName}
                onChange={(e) => setContext({ ...context, brandName: e.target.value })}
                className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
              />
            </div>

          </div>
        </div>

        {/* Content Type Selection */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">نوع المحتوى</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              { id: "page_title" as const, label: "عنوان الصفحة" },
              { id: "page_description" as const, label: "وصف الصفحة" },
              { id: "cta_text" as const, label: "نص CTA" },
              { id: "product_description" as const, label: "وصف المنتج" }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setContentType(type.id)}
                className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
                  contentType === type.id
                    ? "bg-brand-primary text-brand-accent"
                    : "border border-white/20 text-white/70 hover:border-brand-primary hover:text-brand-primary"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateContent}
          disabled={generating}
          className="w-full rounded-full bg-brand-primary px-6 py-3 text-lg font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:opacity-50"
        >
          {generating ? "جاري التوليد..." : "توليد المحتوى"}
        </button>

        {/* Generated Content */}
        {generatedContent && (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-semibold text-white mb-4">المحتوى المُوَلَّد</h2>
            <div className="mb-6 rounded-lg border border-brand-primary/30 bg-brand-primary/10 p-4">
              <p className="text-white">{generatedContent}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => improveContent("seo")}
                disabled={generating}
                className="rounded border border-brand-primary px-4 py-2 text-sm text-brand-primary hover:bg-brand-primary/10 disabled:opacity-50"
              >
                تحسين SEO
              </button>
              <button
                onClick={() => improveContent("clarity")}
                disabled={generating}
                className="rounded border border-brand-primary px-4 py-2 text-sm text-brand-primary hover:bg-brand-primary/10 disabled:opacity-50"
              >
                تحسين الوضوح
              </button>
              <button
                onClick={() => improveContent("persuasion")}
                disabled={generating}
                className="rounded border border-brand-primary px-4 py-2 text-sm text-brand-primary hover:bg-brand-primary/10 disabled:opacity-50"
              >
                زيادة الإقناع
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedContent);
                }}
                className="rounded border border-brand-primary px-4 py-2 text-sm text-brand-primary hover:bg-brand-primary/10"
              >
                نسخ
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}