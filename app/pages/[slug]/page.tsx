import { notFound } from "next/navigation";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentTenant } from "@/lib/tenant";
import { getRuntimeConfig } from "@/lib/runtime-config";
import DynamicPageClient from "@/components/dynamic-page-client";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export type PageData = {
  id: string;
  slug: string;
  title: string;
  seo_title?: string;
  seo_description?: string;
  og_image?: string;
  sections: SectionData[];
};

export type SectionData = {
  id: string;
  type: string;
  position: number;
  config: {
    [key: string]: unknown;
  };
};

async function getPageData(slug: string): Promise<PageData | null> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return null;
  }

  const supabase = getSupabaseAdminClient();

  // Get the page
  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id, slug, title, seo_title, seo_description, og_image")
    .eq("company_id", tenant.id)
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (pageError || !page) {
    return null;
  }

  // Get the page sections
  const { data: sections, error: sectionsError } = await supabase
    .from("page_sections")
    .select("id, type, position, config")
    .eq("company_id", tenant.id)
    .eq("page_id", page.id)
    .eq("status", "published")
    .order("position", { ascending: true });

  if (sectionsError) {
    console.error("Error fetching page sections:", sectionsError);
    return null;
  }

  return {
    ...page,
    sections: sections || [],
  };
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const pageData = await getPageData(slug);

  if (!pageData) {
    return {
      title: "Page Not Found",
    };
  }

  return {
    title: pageData.seo_title || pageData.title,
    description: pageData.seo_description,
    openGraph: {
      title: pageData.seo_title || pageData.title,
      description: pageData.seo_description,
      images: pageData.og_image ? [{ url: pageData.og_image }] : [],
    },
  };
}

export default async function DynamicPage({ params }: PageProps) {
  const { slug } = await params;
  const pageData = await getPageData(slug);
  const runtimeConfig = await getRuntimeConfig();

  if (!pageData) {
    notFound();
  }

  return <DynamicPageClient pageData={pageData} runtimeConfig={runtimeConfig} />;
}