/**
 * Section Preview Route
 * 
 * عرض قسم حقيقي قبل نشره
 * Preview actual sections before publishing
 */

import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  CheckCircle, 
  ArrowLeft, 
  Settings,
  Layout
} from "lucide-react";
import Link from "next/link";

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function SectionPreviewPage({ params }: PreviewPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch section from database
  const { data: section, error } = await supabase
    .from("site_sections")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !section) {
    notFound();
  }

  // Render section content based on type
  const renderSectionContent = () => {
    const content = section.section_content as Record<string, unknown> || {};
    const config = section.section_config as Record<string, unknown> || {};

    switch (section.section_type) {
      case "hero":
        return (
          <div 
            className="relative py-20 px-8 text-center"
            style={{
              background: (config.background as Record<string, string>)?.type === 'gradient' 
                ? `linear-gradient(${config.background})`
                : (config.background as Record<string, string>)?.value || '#f8f9fa'
            }}
          >
            <h1 className="text-4xl font-bold mb-4">{content.title as string || "عنوان القسم"}</h1>
            <p className="text-xl text-gray-600 mb-8">{content.subtitle as string || ""}</p>
            {(content.ctaText as string) && (
              <button className="bg-[#C5A059] text-white px-6 py-3 rounded-lg hover:bg-[#d5b26a]">
                {content.ctaText as string}
              </button>
            )}
          </div>
        );

      case "features":
        return (
          <div className="py-16 px-8">
            <h2 className="text-3xl font-bold text-center mb-12">{content.title as string || "المميزات"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {((content.features as Array<Record<string, string>>) || []).map((feature, idx) => (
                <div key={idx} className="text-center p-6 border rounded-lg">
                  <div className="w-12 h-12 bg-[#C5A059]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Layout className="w-6 h-6 text-[#C5A059]" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title || `ميزة ${idx + 1}`}</h3>
                  <p className="text-gray-600 text-sm">{feature.description || "وصف الميزة"}</p>
                </div>
              ))}
              {(!(content.features as Array<unknown>)?.length) && (
                <>
                  <div className="text-center p-6 border rounded-lg">
                    <h3 className="font-semibold mb-2">ميزة 1</h3>
                    <p className="text-gray-600 text-sm">وضع الميزة هنا</p>
                  </div>
                  <div className="text-center p-6 border rounded-lg">
                    <h3 className="font-semibold mb-2">ميزة 2</h3>
                    <p className="text-gray-600 text-sm">وضع الميزة هنا</p>
                  </div>
                  <div className="text-center p-6 border rounded-lg">
                    <h3 className="font-semibold mb-2">ميزة 3</h3>
                    <p className="text-gray-600 text-sm">وضع الميزة هنا</p>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case "testimonials":
        return (
          <div className="py-16 px-8 bg-gray-50">
            <h2 className="text-3xl font-bold text-center mb-12">{content.title as string || "آراء العملاء"}</h2>
            <div className="max-w-3xl mx-auto">
              <div className="bg-white p-8 rounded-xl shadow-lg">
                <p className="text-lg text-gray-700 italic mb-6">
                  &ldquo;{((content.testimonials as Array<Record<string, string>>)?.[0]?.quote) || "تجربة رائعة مع Azenith Living!"}&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#C5A059] rounded-full flex items-center justify-center text-white font-semibold">
                    {(((content.testimonials as Array<Record<string, string>>)?.[0]?.author) || "عميل")[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{((content.testimonials as Array<Record<string, string>>)?.[0]?.author) || "عميل سعيد"}</p>
                    <p className="text-sm text-gray-500">{((content.testimonials as Array<Record<string, string>>)?.[0]?.role) || "عميل"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="py-16 px-8">
            <h2 className="text-3xl font-bold mb-4">{content.title as string || section.section_name}</h2>
            <p className="text-gray-600">
              هذا قسم من نوع &ldquo;{section.section_type}&rdquo; - يمكن تخصيص محتواه من لوحة التحكم
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Preview Header */}
      <div className="bg-[#161616] text-white py-4 px-6 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Eye className="h-5 w-5 text-[#C5A059]" />
            <div>
              <h1 className="font-semibold">معاينة القسم</h1>
              <p className="text-sm text-white/60">{section.section_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge 
              variant={section.is_active ? "default" : "secondary"}
              className={section.is_active ? "bg-green-500" : ""}
            >
              {section.is_active ? "نشط" : "معطل"}
            </Badge>
            <Badge variant="outline">{section.section_type}</Badge>

            <div className="border-l border-white/20 ml-3 pl-3 flex gap-2">
              <Link href="/admin/intel">
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  رجوع
                </Button>
              </Link>

              <Link href={`/admin/intel?action=edit-section&id=${id}`}>
                <Button size="sm" className="bg-[#C5A059] hover:bg-[#d5b26a] text-[#161616]">
                  <Settings className="h-4 w-4 mr-2" />
                  تعديل
                </Button>
              </Link>

              <Button 
                size="sm" 
                variant="outline"
                className="border-green-500 text-green-500 hover:bg-green-500/10"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                نشر
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Section Info Card */}
      <div className="max-w-7xl mx-auto mt-6 px-6">
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layout className="h-5 w-5 text-[#C5A059]" />
              معلومات القسم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">المعرف</p>
                <p className="font-medium">{section.id}</p>
              </div>
              <div>
                <p className="text-gray-500">النوع</p>
                <p className="font-medium">{section.section_type}</p>
              </div>
              <div>
                <p className="text-gray-500">المكان</p>
                <p className="font-medium">{section.page_placement || "غير محدد"}</p>
              </div>
              <div>
                <p className="text-gray-500">الترتيب</p>
                <p className="font-medium">{section.sort_order}</p>
              </div>
              <div>
                <p className="text-gray-500">تاريخ الإنشاء</p>
                <p className="font-medium">{new Date(section.created_at).toLocaleDateString("ar-EG")}</p>
              </div>
              <div>
                <p className="text-gray-500">آخر تحديث</p>
                <p className="font-medium">{new Date(section.updated_at).toLocaleDateString("ar-EG")}</p>
              </div>
              <div>
                <p className="text-gray-500">الحالة</p>
                <p className="font-medium">{section.is_visible ? "مرئي" : "مخفي"}</p>
              </div>
              <div>
                <p className="text-gray-500">الslug</p>
                <p className="font-medium">{section.section_slug || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Preview */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <Card className="overflow-hidden">
          <div className="bg-white">
            {renderSectionContent()}
          </div>
        </Card>
      </div>

      {/* Preview Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <p className="text-sm text-gray-500">
            هذه معاينة فقط. القسم لن يظهر للزوار حتى يتم نشره.
          </p>
          <div className="flex gap-3">
            <Link href="/admin/intel">
              <Button variant="outline">إلغاء</Button>
            </Link>
            <Button className="bg-[#C5A059] hover:bg-[#d5b26a] text-[#161616]">
              <CheckCircle className="h-4 w-4 mr-2" />
              نشر القسم
            </Button>
          </div>
        </div>
      </div>

      {/* Spacer for fixed footer */}
      <div className="h-20" />
    </div>
  );
}
