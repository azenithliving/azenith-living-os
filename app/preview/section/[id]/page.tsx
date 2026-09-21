/**
 * Authenticated, read-only preview for a stored site section.
 * Publishing and editing are intentionally kept out of this route because it
 * has no corresponding server-side workflow; showing inert controls here made
 * the preview look functional when it was not.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Eye, Layout } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/server";
import { isAuthorizedAdminEmail } from "@/lib/admin-access";

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

type ContentRecord = Record<string, unknown>;

function asRecord(value: unknown): ContentRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ContentRecord : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatDate(value: unknown): string {
  if (typeof value !== "string") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ar-EG");
}

function safeHref(value: unknown): string | null {
  const href = readString(value);
  if (!href) return null;
  return href.startsWith("/") || /^https?:\/\//i.test(href) ? href : null;
}

function PreviewCta({ href, label }: { href: string; label: string }) {
  const className = "inline-flex rounded-lg bg-[#C5A059] px-6 py-3 font-medium text-white transition hover:bg-[#d5b26a]";
  if (/^https?:\/\//i.test(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{label}</a>;
  }
  return <Link href={href} className={className}>{label}</Link>;
}

export default async function SectionPreviewPage({ params }: PreviewPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAuthorizedAdminEmail(user.email)) redirect("/gate/login");

  const { data: section, error } = await supabase
    .from("site_sections")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !section) notFound();

  const content = asRecord(section.section_content);
  const config = asRecord(section.section_config);
  const title = readString(content.title) ?? readString(config.title) ?? readString(section.section_name) ?? "—";

  const renderSectionContent = () => {
    switch (section.section_type) {
      case "hero": {
        const subtitle = readString(content.subtitle) ?? readString(content.description);
        const ctaLabel = readString(content.ctaText) ?? readString(content.cta_text);
        const ctaHref = safeHref(content.ctaHref) ?? safeHref(content.cta_url);
        return (
          <section className="space-y-6 px-8 py-20 text-center">
            <h2 className="text-4xl font-bold">{title}</h2>
            {subtitle && <p className="mx-auto max-w-3xl text-xl leading-8 text-gray-600">{subtitle}</p>}
            {ctaLabel && ctaHref ? <PreviewCta href={ctaHref} label={ctaLabel} /> : null}
            {ctaLabel && !ctaHref ? <p className="text-sm text-gray-500">يوجد نص للإجراء، لكن لا يوجد رابط مهيأ له.</p> : null}
          </section>
        );
      }

      case "features": {
        const features = Array.isArray(content.features)
          ? content.features.map(asRecord).filter((feature) => Object.keys(feature).length > 0)
          : [];
        return (
          <section className="space-y-10 px-8 py-16">
            <h2 className="text-center text-3xl font-bold">{title}</h2>
            {features.length > 0 ? (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                {features.map((feature, index) => {
                  const featureTitle = readString(feature.title);
                  const description = readString(feature.description);
                  return <div key={`${featureTitle ?? "feature"}-${index}`} className="rounded-lg border p-6 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#C5A059]/20"><Layout className="h-6 w-6 text-[#C5A059]" /></div>
                    {featureTitle && <h3 className="mb-2 font-semibold">{featureTitle}</h3>}
                    {description && <p className="text-sm leading-6 text-gray-600">{description}</p>}
                  </div>;
                })}
              </div>
            ) : <p className="text-center text-gray-500">لا توجد ميزات مسجلة لهذا القسم.</p>}
          </section>
        );
      }

      case "testimonials": {
        const testimonials = Array.isArray(content.testimonials)
          ? content.testimonials.map(asRecord).filter((testimonial) => Object.keys(testimonial).length > 0)
          : [];
        return (
          <section className="space-y-10 bg-gray-50 px-8 py-16">
            <h2 className="text-center text-3xl font-bold">{title}</h2>
            {testimonials.length > 0 ? (
              <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
                {testimonials.map((testimonial, index) => {
                  const quote = readString(testimonial.quote);
                  const author = readString(testimonial.author);
                  const role = readString(testimonial.role);
                  return <article key={`${author ?? "testimonial"}-${index}`} className="rounded-xl bg-white p-6 shadow-sm">
                    {quote && <p className="text-lg leading-8 text-gray-700">&ldquo;{quote}&rdquo;</p>}
                    {(author || role) && <p className="mt-5 text-sm text-gray-500">{[author, role].filter(Boolean).join(" — ")}</p>}
                  </article>;
                })}
              </div>
            ) : <p className="text-center text-gray-500">لا توجد شهادات عملاء مسجلة لهذا القسم.</p>}
          </section>
        );
      }

      default: {
        const description = readString(content.description) ?? readString(content.content) ?? readString(config.description) ?? readString(config.content);
        return (
          <section className="space-y-4 px-8 py-16">
            <h2 className="text-3xl font-bold">{title}</h2>
            {description ? <p className="whitespace-pre-wrap leading-8 text-gray-600">{description}</p> : <p className="text-gray-500">لا توجد بيانات مرئية إضافية لهذا القسم.</p>}
          </section>
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-24" dir="rtl">
      <header className="sticky top-0 z-50 bg-[#161616] px-6 py-4 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Eye className="h-5 w-5 text-[#C5A059]" />
            <div><h1 className="font-semibold">معاينة إدارية للقراءة فقط</h1><p className="text-sm text-white/60">{section.section_name}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={section.is_active ? "default" : "secondary"} className={section.is_active ? "bg-green-500" : ""}>{section.is_active ? "نشط" : "معطل"}</Badge>
            <Badge variant="outline">{section.section_type}</Badge>
            <Link href="/admin/agents"><Button variant="ghost" size="sm" className="text-white/80 hover:text-white"><ArrowLeft className="ml-2 h-4 w-4" />العودة للإدارة</Button></Link>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-7xl px-6">
        <Card className="mb-6">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Layout className="h-5 w-5 text-[#C5A059]" />معلومات القسم</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div><p className="text-gray-500">المعرف</p><p className="break-all font-medium">{section.id}</p></div>
              <div><p className="text-gray-500">النوع</p><p className="font-medium">{section.section_type}</p></div>
              <div><p className="text-gray-500">المكان</p><p className="font-medium">{section.page_placement || "—"}</p></div>
              <div><p className="text-gray-500">الترتيب</p><p className="font-medium">{section.sort_order ?? "—"}</p></div>
              <div><p className="text-gray-500">تاريخ الإنشاء</p><p className="font-medium">{formatDate(section.created_at)}</p></div>
              <div><p className="text-gray-500">آخر تحديث</p><p className="font-medium">{formatDate(section.updated_at)}</p></div>
              <div><p className="text-gray-500">الحالة</p><p className="font-medium">{section.is_visible ? "مرئي" : "مخفي"}</p></div>
              <div><p className="text-gray-500">المعرّف النصي</p><p className="font-medium">{section.section_slug || "—"}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden"><div className="bg-white">{renderSectionContent()}</div></Card>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 border-t bg-white px-6 py-4 shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><p className="text-sm text-gray-500">هذه المعاينة لا تغيّر حالة القسم أو تنشره.</p><Link href="/admin/agents"><Button variant="outline">عودة</Button></Link></div>
      </footer>
    </div>
  );
}
