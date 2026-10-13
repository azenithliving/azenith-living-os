/**
 * app/api/admin/shop — the owner's own door onto the ready-products shelf.
 *
 * Measured 2026-10-13: the products table held one row («صوفا ملكية») written while another agent
 * was building the store, and the `/api/admin/products` door that could edit it had zero callers in
 * the repository — no screen ever used it. This door replaces it for the owner's desk and carries the
 * shelf's own rule from `lib/shop/shelf`, so what the desk reports and what a visitor is shown are
 * the same answer read from the same place.
 *
 * What it deliberately does not have: a delete. A row being erased is the owner's word, never an
 * agent's button — the desk can hide a piece from customers, which is reversible.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiAccess, AdminApiAuthError } from "@/lib/admin-api-auth";
import { resolvePrimaryCompanyId } from "@/lib/company-resolver";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { coverOf, isDisplayable, priceOf, SHELF_BUCKET } from "@/lib/shop/rule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** The two answers a customer needs before a piece may stand on the shelf. */
function missingFor(row: Record<string, unknown>): string[] {
  const missing: string[] = [];
  if (!(priceOf(row) > 0)) missing.push("السعر");
  if (!coverOf(row)) missing.push("الصورة");
  if (row.is_active !== true) missing.push("موافقتك على العرض");
  return missing;
}

/**
 * What the owner reads when the record refuses. The database answers in machine English
 * («insert or update on table "products" violates foreign key constraint…»); his screen carries
 * Arabic only, so the reason is translated by kind and the raw text is never pasted. When nothing
 * matches, the desk says it was refused and leaves the detail to the watcher rather than dressing
 * the owner in a constraint name.
 */
function arabicReason(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("foreign key")) return "المتجر ما عرفش يربط السطر بصاحبه — السطر ما اتسجلّش";
  if (m.includes("null value")) return "في خانة ضرورية فاضية — السطر ما اتسجلّش";
  if (m.includes("unique") || m.includes("duplicate")) return "في سطر بنفس الاسم أو الرمز اتسجل قبل كده";
  if (m.includes("permission") || m.includes("row-level")) return "الصلاحية مانعة الكتابة دلوقتي";
  return "السجل رفض السطر — السبب اتسجّل في مراقبة الموقع";
}

function unauthorized(error: unknown) {
  if (error instanceof AdminApiAuthError) {
    return NextResponse.json({ success: false, error: "لازم تكون داخل بحسابك عشان تعدّل الرفّ" }, { status: error.status });
  }
  throw error;
}

function arabicSlug(name: string): string {
  const clean = name
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${clean || "piece"}-${Date.now().toString(36)}`;
}

function splitDataUrl(raw: string): { base64: string; mime: string | null } {
  const match = raw.match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,([\s\S]+)$/);
  if (match) return { base64: match[3], mime: match[1] === "image/jpg" ? "image/jpeg" : match[1] };
  return { base64: raw, mime: null };
}

type DeskRow = {
  id: string;
  name: string;
  price: number;
  shortDescription: string;
  coverPath: string;
  isActive: boolean;
  displayable: boolean;
  missing: string[];
  createdAt: string | null;
};

/** Every piece the owner has entered — shown or not — because his desk must tell him what is missing. */
export async function GET(request: NextRequest) {
  let access;
  try {
    access = await requireAdminApiAccess(request);
  } catch (error) {
    return unauthorized(error);
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("products")
    .select("id,name,sale_price,base_price,short_description,featured_image_url,is_active,created_at")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    return NextResponse.json({ success: false, error: `السجل ما رجّعش حاجة — ${arabicReason(error.message)}` }, { status: 500 });
  }

  const rows: DeskRow[] = (data as Record<string, unknown>[] | null ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    price: priceOf(row),
    shortDescription: String(row.short_description ?? ""),
    coverPath: coverOf(row),
    isActive: row.is_active === true,
    displayable: isDisplayable(row),
    missing: missingFor(row),
    createdAt: row.created_at ? String(row.created_at) : null,
  }));

  return NextResponse.json({ success: true, rows, readback: rows.length, by: access.email });
}

/** Puts a piece on the shelf: his words, his price, and optionally his own photograph. */
export async function POST(request: NextRequest) {
  let access;
  try {
    access = await requireAdminApiAccess(request);
  } catch (error) {
    return unauthorized(error);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير مفهوم" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const price = Number(body.price ?? 0);
  if (!name) return NextResponse.json({ success: false, error: "اسم القطعة مطلوب" }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ success: false, error: "السعر لازم يكون رقم أكبر من صفر" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const companyId = await resolvePrimaryCompanyId();
  if (!supabase || !companyId) {
    return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });
  }

  let cover = typeof body.coverUrl === "string" ? body.coverUrl.trim() : "";
  const rawImage = typeof body.image === "string" ? body.image : "";
  if (rawImage) {
    const { base64, mime } = splitDataUrl(rawImage);
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: `حجم الصورة غير مقبول (${buffer.length} بايت، الحد ${MAX_IMAGE_BYTES})` },
        { status: 400 }
      );
    }
    const type = mime ?? "image/png";
    const path = `shop/${companyId}/${Date.now()}.${EXT_BY_MIME[type] ?? "png"}`;
    const upload = await supabase.storage.from(SHELF_BUCKET).upload(path, buffer, { contentType: type, upsert: false });
    if (upload.error) {
      return NextResponse.json({ success: false, error: "الصورة ما اتخزنّتش — القطعة ما اتسجلّش" }, { status: 500 });
    }
    cover = path;
  }

  const shortDescription = typeof body.shortDescription === "string" ? body.shortDescription.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  /**
   * `created_by` points at the store's staff register, not at the sign-in account, and the register
   * holds no row for the owner's login (measured: 0 rows in `users` for the gate email, while the
   * first insert attempt was refused by that very foreign key). So the writer is looked up by email
   * and left blank when the register does not know him — a piece of his furniture must not fail to
   * reach his shelf because his name is not filed as staff.
   */
  const staff = await supabase.from("users").select("id").eq("email", access.email).maybeSingle();

  const { data, error } = await supabase
    .from("products")
    .insert({
      company_id: companyId,
      created_by: staff?.data?.id ?? null,
      name,
      slug: arabicSlug(name),
      base_price: price,
      sale_price: price,
      currency: "EGP",
      short_description: shortDescription,
      description,
      featured_image_url: cover || null,
      is_active: true,
      visibility: "visible",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: `${arabicReason(error?.message)} — المكتوب: ١، المخزّن: ٠` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: data.id, wrote: 1, stored: 1 });
}

/** Edits a piece, or hides it from customers. Never erases one. */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
  } catch (error) {
    return unauthorized(error);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير مفهوم" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ success: false, error: "القطعة مطلوبة" }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ success: false, error: "السعر لازم يكون رقم أكبر من صفر" }, { status: 400 });
    }
    patch.sale_price = price;
    patch.base_price = price;
  }
  if (typeof body.shortDescription === "string") patch.short_description = body.shortDescription.trim();
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (typeof body.show === "boolean") {
    patch.is_active = body.show;
    patch.visibility = body.show ? "visible" : "hidden";
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: "مفيش حاجة تتغيّرت" }, { status: 400 });
  }

  const { data, error } = await supabase.from("products").update(patch).eq("id", id).select("id,is_active,sale_price,featured_image_url").single();
  if (error || !data) {
    return NextResponse.json({ success: false, error: `التعديل ما اتسجلّش — ${arabicReason(error?.message)}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, row: data, stored: 1 });
}
