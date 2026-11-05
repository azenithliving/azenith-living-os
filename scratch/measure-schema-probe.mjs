import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.local", ".env"]) {
  const p = process.cwd() + "/" + f;
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const out = [];
const log = (s) => {
  out.push(s);
  console.log(s);
};

if (!url || !key) {
  log("NO_CREDENTIALS url=" + !!url + " key=" + !!key);
  fs.writeFileSync("scratch/measure-schema-probe.out", out.join("\n") + "\n");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const REQUIRED = [
  { table: "automation_rules", columns: ["company_id", "enabled", "is_active"] },
  { table: "approval_requests", columns: ["company_id", "actor_user_id", "command_log_id"] },
  { table: "audit_log", columns: ["company_id", "actor_user_id", "approval_request_id", "command_log_id"] },
  {
    table: "agent_memory",
    columns: [
      "memory_type",
      "type",
      "category",
      "content",
      "context",
      "user_id",
      "priority",
      "outcome",
      "user_feedback",
      "expires_at",
    ],
  },
];

async function probe(table, column) {
  const { data, error } = await supabase.from(table).select(column).limit(1);
  return {
    ok: !error,
    code: error ? String(error.code ?? "-") : null,
    message: error ? String(error.message ?? "").slice(0, 160) : null,
    rows: Array.isArray(data) ? data.length : -1,
  };
}

try {
  log("== question 1: does a column projection name a missing column? ==");
  const fakeColumn = await probe("approval_requests", "no_such_column_probe");
  log(
    "CONTROL_MISSING_COLUMN ok=" +
      fakeColumn.ok +
      " code=" +
      fakeColumn.code +
      " msg=" +
      fakeColumn.message
  );

  log("== question 2: does it name a missing table differently? ==");
  const fakeTable = await probe("no_such_table_probe", "id");
  log("CONTROL_MISSING_TABLE ok=" + fakeTable.ok + " code=" + fakeTable.code + " msg=" + fakeTable.message);

  log("== question 3: what does the old information_schema read actually answer? ==");
  const info = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "approval_requests");
  log(
    "INFORMATION_SCHEMA ok=" +
      !info.error +
      " rows=" +
      (Array.isArray(info.data) ? info.data.length : -1) +
      " code=" +
      (info.error ? String(info.error.code ?? "-") : "-") +
      " msg=" +
      (info.error ? String(info.error.message ?? "").slice(0, 160) : "-")
  );

  log("== question 4: does select(*) on a live table hand back the column names? ==");
  for (const relation of REQUIRED) {
    const { data, error } = await supabase.from(relation.table).select("*").limit(1);
    const rows = Array.isArray(data) ? data : [];
    const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
    log(
      "STAR " +
        relation.table +
        " ok=" +
        !error +
        " rows=" +
        rows.length +
        " keys=" +
        keys.length +
        (error ? " code=" + String(error.code ?? "-") : "")
    );
    if (keys.length > 0) log("  keys: " + keys.join(","));
  }

  log("== question 5: per-column probe on every required column ==");
  for (const relation of REQUIRED) {
    for (const column of relation.columns) {
      const r = await probe(relation.table, column);
      log(
        "PROBE " +
          relation.table +
          "." +
          column +
          " present=" +
          r.ok +
          " rows=" +
          r.rows +
          (r.ok ? "" : " code=" + r.code + " msg=" + r.message)
      );
    }
  }

  log("== question 6: is a two-column projection atomic (one missing kills both)? ==");
  const pair = await supabase.from("approval_requests").select("id,no_such_column_probe").limit(1);
  log(
    "PAIR ok=" +
      !pair.error +
      " code=" +
      (pair.error ? String(pair.error.code ?? "-") : "-") +
      " msg=" +
      (pair.error ? String(pair.error.message ?? "").slice(0, 200) : "-")
  );
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  fs.writeFileSync("scratch/measure-schema-probe.out", out.join("\n") + "\n");
}
