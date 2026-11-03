import "server-only";

/**
 * The record's own inventory, read the one way this door can be answered.
 *
 * Measured on the live store 2026-11-03: asking PostgREST for `information_schema` answers PGRST205
 * («no such table») because a system view is not something it serves — that is what made the old
 * census blind. The root document, asked with `Accept: application/json`, answers instead with
 * every exposed relation and its columns: 160 definitions, `audit_log` 9 columns, `agent_memory` 13,
 * `automation_rules` 9 — the same shape the record hands back when its columns are probed directly.
 */
export type InventoryColumn = { name: string; type: string; required: boolean };
export type InventoryTable = { name: string; columns: InventoryColumn[] };

export type RecordInventory =
  | { ok: true; tables: InventoryTable[] }
  | { ok: false; error: string };

type Definition = {
  properties?: Record<string, { type?: string }>;
  required?: string[];
};

export async function fetchRecordInventory(): Promise<RecordInventory> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === "placeholder-service-key") {
    return { ok: false, error: "مخزن المتجر مش متصل دلوقتي" };
  }

  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Accept: "application/json" } });
  } catch {
    return { ok: false, error: "السجل ما ردّش على طلب الجرد" };
  }

  if (!response.ok) {
    return { ok: false, error: `السجل ردّ بـ ${response.status} على طلب الجرد` };
  }

  let spec: unknown;
  try {
    spec = await response.json();
  } catch {
    return { ok: false, error: "رد السجل على طلب الجرد ما كانش قائمة مفهومة" };
  }

  const definitions = (spec as { definitions?: Record<string, Definition> }).definitions;
  if (!definitions || Object.keys(definitions).length === 0) {
    return { ok: false, error: "السجل ردّ من غير قائمة جداول" };
  }

  const tables: InventoryTable[] = Object.entries(definitions).map(([name, def]) => {
    const required = new Set(def?.required ?? []);
    const columns: InventoryColumn[] = Object.entries(def?.properties ?? {}).map(([columnName, meta]) => ({
      name: columnName,
      type: meta?.type ?? "unknown",
      required: required.has(columnName),
    }));
    return { name, columns };
  });

  return { ok: true, tables };
}
