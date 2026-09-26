/**
 * قيّم الدار — visitor-facing website operations (v2)
 * Reads and writes public presentation records only: room_sections, products, site_sections, site_settings.
 * Full versioning, preview tokens, and instant rollback.
 * Never touches inventory, production jobs, or factory BOM.
 */

import { supabaseServer } from "@/lib/dal/unified-supabase";
import { belongsToStore } from "@/lib/company-scope";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { resolveMasterCompanyId } from "@/lib/admin-env-resolver";
import type { ToolExecutionResult } from "@/lib/agent-tools/tool-registry";
import { revalidatePath } from "next/cache";

export type RoomRow = {
  id: string;
  slug: string | null;
  name: string | null;
  name_ar: string | null;
  description: string | null;
  image_url?: string | null;
  is_active?: boolean | null;
  display_order?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type ProductRow = {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  short_description: string | null;
  featured_image_url: string | null;
  is_active: boolean | null;
  visibility: string | null;
  is_featured: boolean | null;
};

export type Issue = {
  kind: string;
  target: string;
  id: string;
  path: string;
  detail: string;
};

export interface QayyimDraftRow {
  id: string;
  company_id?: string | null;
  target_table: string;
  target_id: string;
  target_path?: string | null;
  proposed: Record<string, any>;
  previous?: Record<string, any> | null;
  version: number;
  parent_version_id?: string | null;
  status: 'draft' | 'previewing' | 'published' | 'rejected' | 'rolled_back';
  preview_token: string;
  preview_expires_at?: string | null;
  created_by?: string;
  approved_by?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
  draft_type?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
  published_at?: string | null;
  rolled_back_at?: string | null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasLatinOnly(value: string): boolean {
  return /[A-Za-z]{4,}/.test(value) && !/[\u0600-\u06FF]/.test(value);
}

export async function resolveCompanyId(hint?: string | null): Promise<string | null> {
  return (await resolveAdminCompanyId(hint)) || (await resolveMasterCompanyId());
}

export function roomPath(room: RoomRow) {
  const slug = asText(room.slug) || room.id;
  return `/#${slug}`;
}

export function productPath(product: ProductRow) {
  const slug = asText(product.slug);
  return slug ? `/products/${slug}` : `/admin/products`;
}

export async function loadRooms(companyId: string | null): Promise<RoomRow[]> {
  // Deliberately not filtered in SQL: the live sections were stamped with more
  // than one company id, and a single-id filter made the swarm report an empty
  // shop. 15 rows, so scoping in JS with the shared answer is cheaper than a
  // bug. See lib/company-scope.ts.
  const { data, error } = await supabaseServer
    .from("room_sections")
    .select("id, slug, name, name_ar, description, image_url, is_active, display_order, metadata, company_id")
    .order("display_order", { ascending: true })
    .limit(80);
  if (error) {
    const retry = await supabaseServer
      .from("room_sections")
      .select("id, slug, name, name_ar, description, is_active, display_order, metadata")
      .order("display_order", { ascending: true })
      .limit(80);
    return (retry.data || []) as RoomRow[];
  }
  const rows = (data || []) as (RoomRow & { company_id?: string | null })[];
  return rows.filter((r) => belongsToStore(r.company_id, companyId));
}

export async function loadProducts(): Promise<ProductRow[]> {
  const { data, error } = await supabaseServer
    .from("products")
    .select("id, name, slug, description, short_description, featured_image_url, is_active, visibility, is_featured")
    .order("name")
    .limit(80);
  if (error) return [];
  return (data || []) as ProductRow[];
}

/**
 * ── 1. تدقيق شامل للواجهة الظاهرة للزائر ──────────────────────────────────
 */
export async function auditVisitorExperience(companyHint?: string | null): Promise<ToolExecutionResult> {
  const companyId = await resolveCompanyId(companyHint);
  const rooms = await loadRooms(companyId);
  const products = await loadProducts();
  const issues: Issue[] = [];

  if (rooms.length === 0 && products.length === 0) {
    return {
      success: false,
      message: "لا توجد غرف في room_sections ولا منتجات في products. قيّم الدار لا يملك ما يفحصه على الواجهة بعد.",
      data: { rooms: 0, products: 0, issues: [] },
    };
  }

  for (const room of rooms) {
    const title = asText(room.name_ar) || asText(room.name) || room.id;
    if (!room.is_active) {
      issues.push({
        kind: "room_hidden",
        target: title,
        id: room.id,
        path: roomPath(room),
        detail: "الغرفة غير مفعّلة ولن تظهر للزائر.",
      });
    }
    if (!asText(room.name_ar) && !asText(room.name)) {
      issues.push({
        kind: "room_untitled",
        target: room.id,
        id: room.id,
        path: roomPath(room),
        detail: "الغرفة بلا اسم ظاهر.",
      });
    }
    if (!asText(room.description)) {
      issues.push({
        kind: "room_no_description",
        target: title,
        id: room.id,
        path: roomPath(room),
        detail: "لا يوجد وصف للزائر.",
      });
    }
    if (!asText(room.image_url)) {
      issues.push({
        kind: "room_no_image",
        target: title,
        id: room.id,
        path: roomPath(room),
        detail: "لا توجد صورة غلاف.",
      });
    }
    if (asText(room.description) && hasLatinOnly(asText(room.description))) {
      issues.push({
        kind: "room_latin_copy",
        target: title,
        id: room.id,
        path: roomPath(room),
        detail: "الوصف الظاهر لاتيني بلا عربي.",
      });
    }
  }

  for (const product of products) {
    const title = asText(product.name) || product.id;
    const visible = product.is_active !== false && product.visibility !== "hidden";
    if (!visible) continue;
    if (!asText(product.description) && !asText(product.short_description)) {
      issues.push({
        kind: "product_no_copy",
        target: title,
        id: product.id,
        path: productPath(product),
        detail: "منتج ظاهر بلا وصف.",
      });
    }
    if (!asText(product.featured_image_url)) {
      issues.push({
        kind: "product_no_image",
        target: title,
        id: product.id,
        path: productPath(product),
        detail: "منتج ظاهر بلا صورة رئيسية.",
      });
    }
  }

  const visibleRooms = rooms.filter((room) => room.is_active !== false).length;
  const visibleProducts = products.filter(
    (product) => product.is_active !== false && product.visibility !== "hidden"
  ).length;

  return {
    success: true,
    message: `فحص الواجهة من room_sections و products: ${visibleRooms} غرفة ظاهرة، ${visibleProducts} منتج ظاهر، ${issues.length} ملاحظة موثّقة بروابط.`,
    data: {
      visible_rooms: visibleRooms,
      total_rooms: rooms.length,
      visible_products: visibleProducts,
      total_products: products.length,
      issues,
      source_tables: ["room_sections", "products"],
    },
  };
}

export async function listPublicRooms(companyHint?: string | null): Promise<ToolExecutionResult> {
  const companyId = await resolveCompanyId(companyHint);
  const rooms = await loadRooms(companyId);
  const items = rooms.map((room) => ({
    id: room.id,
    slug: room.slug,
    name: asText(room.name_ar) || asText(room.name) || "بدون اسم",
    description: asText(room.description) || null,
    image: asText(room.image_url) || null,
    visible: room.is_active !== false,
    path: roomPath(room),
  }));
  return {
    success: true,
    message: `غرف الموقع من جدول room_sections: ${items.length} سجل، منها ${items.filter((item) => item.visible).length} ظاهر للزائر.`,
    data: { items, source_table: "room_sections" },
  };
}

export async function listStorefrontProducts(): Promise<ToolExecutionResult> {
  const products = await loadProducts();
  const items = products.map((product) => ({
    id: product.id,
    name: asText(product.name) || "بدون اسم",
    path: productPath(product),
    visible: product.is_active !== false && product.visibility !== "hidden",
    featured: product.is_featured === true,
    has_description: Boolean(asText(product.description) || asText(product.short_description)),
    has_image: Boolean(asText(product.featured_image_url)),
  }));
  return {
    success: true,
    message: `بطاقات المنتجات من جدول products: ${items.length} منتج، الظاهر منها ${items.filter((item) => item.visible).length}. الكميات والمخزن خارج اختصاص قيّم الدار.`,
    data: { items, source_table: "products" },
  };
}

/**
 * ── 2. إنشاء مسودة في qayyim_drafts v2 ──────────────────────────────────
 */
export async function createQayyimDraft(params: {
  targetTable: string; // 'room_sections' | 'products' | 'site_sections' | 'site_settings'
  targetId: string;
  targetPath?: string;
  proposed: Record<string, any>;
  previous?: Record<string, any> | null;
  draftType?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
  companyId?: string | null;
}): Promise<ToolExecutionResult> {
  try {
    const companyId = await resolveCompanyId(params.companyId);
    
    // Fetch previous content if not supplied
    let previous = params.previous;
    if (!previous && params.targetId) {
      const { data: currentRecord } = await supabaseServer
        .from(params.targetTable)
        .select("*")
        .eq("id", params.targetId)
        .maybeSingle();
      if (currentRecord) {
        previous = currentRecord;
      }
    }

    // Determine current version number
    const { data: latestDraft } = await supabaseServer
      .from("qayyim_drafts")
      .select("version, id")
      .eq("target_table", params.targetTable)
      .eq("target_id", params.targetId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = latestDraft ? (Number(latestDraft.version) || 1) + 1 : 1;
    const parentVersionId = latestDraft?.id || null;
    const previewToken = crypto.randomUUID();

    const { data: newDraft, error } = await supabaseServer
      .from("qayyim_drafts")
      .insert({
        company_id: companyId,
        target_table: params.targetTable,
        target_id: params.targetId,
        target_path: params.targetPath || "/",
        proposed: params.proposed,
        previous: previous || {},
        version,
        parent_version_id: parentVersionId,
        status: "draft",
        preview_token: previewToken,
        created_by: params.createdBy || "qayyim",
        draft_type: params.draftType || "content",
        metadata: params.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !newDraft) {
      throw new Error(error?.message || "فشل إدخال المسودة في قاعدة البيانات");
    }

    return {
      success: true,
      message: `تم إنشاء المسودة بنجاح (رقم ${newDraft.id.slice(0, 8)}) الإصدار v${version}. للمعاينة: /preview?token=${previewToken}`,
      data: {
        draft_id: newDraft.id,
        version: newDraft.version,
        preview_token: newDraft.preview_token,
        preview_url: `/preview?token=${previewToken}`,
        target_table: newDraft.target_table,
        target_id: newDraft.target_id,
        target_path: newDraft.target_path,
        status: newDraft.status,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `تعذر إنشاء المسودة: ${err.message}`,
      data: { error: err.message },
    };
  }
}

/**
 * ── 3. نشر المسودة المعتمدة وتحديث الموقع الحي ────────────────────────────
 */
export async function publishQayyimDraft(
  draftId: string,
  approvedBy: string,
  companyHint?: string | null
): Promise<ToolExecutionResult> {
  try {
    const companyId = await resolveCompanyId(companyHint);

    const { data: draft, error: fetchErr } = await supabaseServer
      .from("qayyim_drafts")
      .select("*")
      .eq("id", draftId)
      .maybeSingle();

    if (fetchErr || !draft) {
      return { success: false, message: `المسودة غير موجودة: ${draftId}` };
    }

    if (draft.status === "published") {
      return { success: false, message: `المسودة منشورة بالفعل بتاريخ ${draft.published_at}` };
    }

    const proposed = draft.proposed || {};
    if (Object.keys(proposed).length === 0) {
      return { success: false, message: "لا توجد تعديلات محددة في المسودة لتطبيقها." };
    }

    // Apply proposed changes to the target table
    const targetTable = draft.target_table;
    const targetId = draft.target_id;

    // Remove any readonly fields from proposed update
    const updatePayload = { ...proposed };
    delete updatePayload.id;
    delete updatePayload.created_at;
    updatePayload.updated_at = new Date().toISOString();

    const { error: applyErr } = await supabaseServer
      .from(targetTable)
      .update(updatePayload)
      .eq("id", targetId);

    if (applyErr) {
      return { success: false, message: `فشل تحديث الجدول ${targetTable}: ${applyErr.message}` };
    }

    // Mark draft as published
    await supabaseServer
      .from("qayyim_drafts")
      .update({
        status: "published",
        approved_by: approvedBy,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId);

    // Revalidate Next.js cache for the target path
    const path = draft.target_path || "/";
    try {
      revalidatePath(path);
      revalidatePath("/");
    } catch {
      // Revalidation may be silent if outside Next request context
    }

    return {
      success: true,
      message: `تم نشر المسودة (v${draft.version}) على ${targetTable} بنجاح بعد موافقة ${approvedBy}. التغيير ظاهر للزائر الآن.`,
      data: {
        draft_id: draft.id,
        version: draft.version,
        target_table: targetTable,
        target_id: targetId,
        target_path: path,
        published_at: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `خطأ أثناء النشر: ${err.message}`,
    };
  }
}

/**
 * ── 4. التراجع الفوري إلى نسخة سابقة (Rollback) ──────────────────────────
 */
export async function rollbackQayyimDraft(
  draftId: string,
  targetVersion?: number,
  companyHint?: string | null
): Promise<ToolExecutionResult> {
  try {
    const { data: draft, error: fetchErr } = await supabaseServer
      .from("qayyim_drafts")
      .select("*")
      .eq("id", draftId)
      .maybeSingle();

    if (fetchErr || !draft) {
      return { success: false, message: `المسودة غير موجودة للتراجع: ${draftId}` };
    }

    let snapshotToRestore = draft.previous;

    // If targetVersion is specified and differs from previous snapshot, look for that specific version
    if (targetVersion && targetVersion !== (draft.version - 1)) {
      const { data: targetDraft } = await supabaseServer
        .from("qayyim_drafts")
        .select("proposed, previous, version")
        .eq("target_table", draft.target_table)
        .eq("target_id", draft.target_id)
        .eq("version", targetVersion)
        .maybeSingle();

      if (targetDraft?.proposed) {
        snapshotToRestore = targetDraft.proposed;
      }
    }

    if (!snapshotToRestore || Object.keys(snapshotToRestore).length === 0) {
      return {
        success: false,
        message: "تعذر التراجع: لا توجد لقطة سابقة محفوظة لهذا السجل.",
      };
    }

    const restorePayload = { ...snapshotToRestore };
    delete restorePayload.id;
    delete restorePayload.created_at;
    restorePayload.updated_at = new Date().toISOString();

    const { error: restoreErr } = await supabaseServer
      .from(draft.target_table)
      .update(restorePayload)
      .eq("id", draft.target_id);

    if (restoreErr) {
      return { success: false, message: `فشل استعادة السجل: ${restoreErr.message}` };
    }

    // Mark current draft as rolled_back
    await supabaseServer
      .from("qayyim_drafts")
      .update({
        status: "rolled_back",
        rolled_back_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId);

    // Revalidate paths
    const path = draft.target_path || "/";
    try {
      revalidatePath(path);
      revalidatePath("/");
    } catch {
      // safe
    }

    return {
      success: true,
      message: `تم التراجع عن المسودة (v${draft.version}) بنجاح واستعادة المحتوى السابق على الموقع.`,
      data: {
        draft_id: draft.id,
        target_table: draft.target_table,
        target_id: draft.target_id,
        target_path: path,
        restored_version: targetVersion || (draft.version - 1),
        rolled_back_at: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `خطأ أثناء التراجع: ${err.message}`,
    };
  }
}

/**
 * ── 5. استرجاع مسودة بواسطة Preview Token ────────────────────────────────
 */
export async function getDraftByPreviewToken(token: string): Promise<QayyimDraftRow | null> {
  const { data, error } = await supabaseServer
    .from("qayyim_drafts")
    .select("*")
    .eq("preview_token", token)
    .maybeSingle();

  if (error || !data) return null;
  return data as QayyimDraftRow;
}

/**
 * ── 6. استعراض المسودات بحالاتها المختلفة ────────────────────────────────
 */
export async function listQayyimDrafts(params?: {
  status?: string;
  limit?: number;
  companyHint?: string | null;
}): Promise<ToolExecutionResult> {
  const companyId = await resolveCompanyId(params?.companyHint);
  let query = supabaseServer
    .from("qayyim_drafts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(params?.limit || 20);

  if (params?.status) {
    query = query.eq("status", params.status);
  }
  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, message: `فشل جلب المسودات: ${error.message}` };
  }

  return {
    success: true,
    message: `تم جلب ${data?.length || 0} مسودة.`,
    data: { drafts: data || [] },
  };
}

/**
 * ── Backward compatibility helpers ──────────────────────────────────────
 */
export async function draftRoomCopy(
  message: string,
  companyHint?: string | null
): Promise<ToolExecutionResult> {
  const companyId = await resolveCompanyId(companyHint);
  const rooms = await loadRooms(companyId);
  if (rooms.length === 0) {
    return { success: false, message: "لا توجد غرف في room_sections لعمل مسودة." };
  }

  function matchRoom(allRooms: RoomRow[], msg: string): RoomRow | null {
    const lower = msg.toLowerCase();
    const bySlug = allRooms.find((room) => asText(room.slug) && lower.includes(asText(room.slug).toLowerCase()));
    if (bySlug) return bySlug;
    const byName = allRooms.find((room) => {
      const ar = asText(room.name_ar);
      const en = asText(room.name);
      return (ar && msg.includes(ar)) || (en && lower.includes(en.toLowerCase()));
    });
    if (byName) return byName;
    return allRooms.find((room) => !asText(room.description)) || allRooms[0] || null;
  }

  const room = matchRoom(rooms, message);
  if (!room) {
    return { success: false, message: "تعذر تحديد الغرفة المستهدفة." };
  }

  const cleaned = message.replace(/جهّ?ز|مسودة|وصف|لغرفة|للغرفة|انشر|أكد|اعتمد/gi, " ").trim();
  const proposedText = cleaned.length >= 10 ? cleaned.slice(0, 800) : asText(room.description);

  return createQayyimDraft({
    companyId,
    targetTable: "room_sections",
    targetId: room.id,
    targetPath: roomPath(room),
    proposed: { description: proposedText },
    previous: { description: room.description },
    draftType: "room_copy",
    createdBy: "ops-content",
  });
}

export async function publishLatestRoomDraft(
  message: string,
  companyHint?: string | null
): Promise<ToolExecutionResult> {
  if (!/انشر|أكد النشر|اعتمد المسودة|publish/i.test(message)) {
    return { success: false, message: "النشر يحتاج تأكيداً صريحاً: اكتبي «انشر المسودة»." };
  }

  const companyId = await resolveCompanyId(companyHint);
  const { data: latest } = await supabaseServer
    .from("qayyim_drafts")
    .select("id")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest?.id) {
    return { success: false, message: "لا توجد مسودة معلقة في qayyim_drafts للنشر." };
  }

  return publishQayyimDraft(latest.id, "مالك الموقع", companyId);
}

export function qayyimOutOfScope(topic: string): ToolExecutionResult {
  const map: Record<string, string> = {
    factory: "المصنع والمخزن والخامات وأوامر التشغيل ليست اختصاص قيّم الدار. استخدمي تبويب التصنيع أو وكيل التشغيل المختص.",
    sales: "العملاء وأوامر البيع من اختصاص Vanguard.",
    money: "الأرقام المالية من اختصاص Analyst.",
    infra: "النسخ الاحتياطي وسرعة السيرفر من اختصاص Ops.",
    security: "الحماية والمفاتيح من اختصاص Security.",
    code: "صحة الـ API والكود من اختصاص Coder.",
  };
  return {
    success: true,
    message: map[topic] || "هذا الطلب خارج إطلالة الموقع ولا ينفّذه قيّم الدار.",
    data: { out_of_scope: true, topic },
  };
}
