/**
 * Authenticated, read-only preview for one of the store's room sections.
 *
 * Measured 2026-10-05 and again 2026-10-09: this page asked the database for
 * `public.site_sections`, and the database answers «the relation does not exist» — so every
 * visit, from every link the cockpit and the employees hand out, could only land on the
 * not-found page. The store's sections really live in `room_sections` (15 rows). The page now
 * reads the register that exists, and stays the one light-surface screen that paints the shared
 * card primitives, so the light theme is provable in a browser and not only in CSS.
 *
 * Publishing and editing are intentionally out of this route: it has no server-side workflow,
 * and inert controls made a preview look functional when it was not.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Eye, ImageOff, Layout } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/server";
import { isAuthorizedAdminEmail } from "@/lib/admin-access";
import { arabicNumerals } from "@/lib/arabic";

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

type RoomSection = {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  display_order: number | null;
  created_at: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ar-EG");
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** A web address is allowed on his screens as its own element, with an Arabic word in front of it. */
function ImageRow({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">صورته:</span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-[#8B7355] underline decoration-dotted">
        صورة القسم
      </a>
    </div>
  );
}

/**
 * Asked whether the stored picture actually answers, because a broken image paints an empty box
 * on his screen and hides the fact. Measured 2026-10-09: every one of the 15 sections points at
 * the same Unsplash address, and that address answers 404 — so this page says it plainly.
 */
async function pictureAnswers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

export default async function SectionPreviewPage({ params }: PreviewPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAuthorizedAdminEmail(user.email)) redirect("/gate/login");

  const { data: section, error } = await supabase
    .from("room_sections")
    .select("id,name,slug,description,image_url,is_active,display_order,created_at")
    .eq("id", id)
    .single();

  if (error || !section) notFound();

  const row = section as RoomSection;
  const title = readString(row.name) ?? "قسم بلا اسم";
  const picture = row.image_url ? await pictureAnswers(row.image_url) : false;

  return (
    <div className="min-h-screen bg-gray-100 pb-24" dir="rtl">
      <header className="sticky top-0 z-50 bg-[#161616] px-6 py-4 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Eye className="h-5 w-5 text-[#C5A059]" />
            <div>
              <h1 className="font-semibold">معاينة إدارية للقراءة فقط</h1>
              <p className="text-sm text-white/60">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={row.is_active ? "default" : "secondary"} className={row.is_active ? "bg-green-500" : ""}>
              {row.is_active ? "نشط" : "معطل"}
            </Badge>
            <Link href="/admin/v2/ops">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white">
                <ArrowLeft className="ml-2 h-4 w-4" />
                العودة للكابينة
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-7xl px-6">
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layout className="h-5 w-5 text-[#C5A059]" />
              معلومات القسم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <p className="text-gray-500">اسم القسم</p>
                <p className="font-medium">{title}</p>
              </div>
              <div>
                <p className="text-gray-500">ترتيبه في العرض</p>
                <p className="font-medium">{row.display_order === null ? "—" : arabicNumerals(String(row.display_order))}</p>
              </div>
              <div>
                <p className="text-gray-500">تاريخ الإنشاء</p>
                <p className="font-medium">{formatDate(row.created_at)}</p>
              </div>
              <div>
                <p className="text-gray-500">الحالة</p>
                <p className="font-medium">{row.is_active ? "ظاهر للعملاء" : "مخفي"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="bg-white">
            <section className="space-y-6 px-8 py-16">
              {row.image_url && picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.image_url} alt={title} className="mx-auto max-h-72 w-full max-w-2xl rounded-xl object-cover" />
              ) : (
                <p className="flex items-center justify-center gap-2 py-10 text-gray-500">
                  <ImageOff className="h-5 w-5" />
                  {row.image_url ? "الصورة المسجّلة للقسم ما بتحمّلتش — الرابط تحت." : "مفيش صورة مسجّلة للقسم ده"}
                </p>
              )}
              <h2 className="text-center text-3xl font-bold">{title}</h2>
              {readString(row.description) ? (
                <p className="mx-auto max-w-3xl text-center text-xl leading-8 text-gray-600">{row.description}</p>
              ) : (
                <p className="text-center text-gray-500">لا يوجد وصف مسجّل لهذا القسم.</p>
              )}
              {row.image_url ? (
                <div className="flex justify-center">
                  <ImageRow url={row.image_url} />
                </div>
              ) : null}
            </section>
          </div>
        </Card>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 border-t bg-white px-6 py-4 shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <p className="text-sm text-gray-500">هذه المعاينة لا تغيّر حالة القسم أو تنشره.</p>
          <Link href="/admin/v2/ops">
            <Button variant="outline">عودة</Button>
          </Link>
        </div>
      </footer>
    </div>
  );
}
