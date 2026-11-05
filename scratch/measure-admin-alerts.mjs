/**
 * measure-admin-alerts.mjs — how the old admin home decides what is an alert.
 *
 * The cockpit strip, the panel and the bell all read the store's one alert rule. This page builds
 * its own list in the browser from two other doors. The script counts the producers, the fields
 * they print, what the page cannot see, and then asks the record what each side would claim right
 * now — so the disagreement is a number, not an impression.
 */
import fs from "node:fs";
import dotenv from "dotenv";
import postgres from "postgres";

for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) dotenv.config({ path: f });

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

const PAGE = process.env.PAGE_FILE ?? "app/admin/page.tsx";
const RULE = "lib/ops/alerts.ts";
const RECORD = process.env.NO_RECORD === "1";
const src = fs.readFileSync(PAGE, "utf8");
const rule = fs.readFileSync(RULE, "utf8");

// ---------- 1. what the rule owns ----------
const types = [...rule.matchAll(/^\s{2}'([a-z_:]+)',?$/gm)].map((m) => m[1]);
const windowExpr = /ALERT_WINDOW_MS = ([0-9 *]+)/.exec(rule)?.[1];
const windowMs = windowExpr ? windowExpr.split("*").reduce((a, b) => a * Number(b.trim()), 1) : 0;
if (!types.length || !windowMs) throw new Error("the alert rule did not answer: types=" + types.length + " window=" + windowMs);
say("RULE_EVENT_TYPES=" + types.length + " WINDOW_MS=" + windowMs);

// ---------- 2. what the page builds instead ----------
const producers = (src.match(/realAlerts\.push\(/g) || []).length;
say("PAGE_ALERT_PRODUCERS=" + producers);

const sources = [...new Set([...src.matchAll(/(?:mastermind|health|analytics)\.[A-Za-z0-9?.]+/g)].map((m) => m[0]))]
  .filter((s) => /alert|failedAttempts|pending/i.test(s));
say("PAGE_ALERT_SOURCES=" + sources.length + " :: " + sources.join(","));

const readsRule = /ops\/alerts|api\/admin\/notifications|readOpenAlerts/.test(src);
say("PAGE_READS_THE_ONE_ALERT_RULE=" + readsRule);
say("PAGE_READS_THE_DOOR_WARNS=" + /warnings/.test(src));

const emptyLines = [...src.matchAll(/>(لا توجد[^<]*)</g)].map((m) => m[1].trim());
say("PAGE_EMPTY_LINES=" + emptyLines.length + " :: " + emptyLines.join(" | "));
say("PAGE_ALERT_EMPTY_LINE=" + (emptyLines.find((s) => /تنبيه/.test(s)) || "none"));

const blockCatch = /catch \(err\)([\s\S]{0,260})/.exec(src)?.[1] || "";
say("PAGE_NAMES_A_REFUSED_ALERT_DOOR=" + /pendingAlerts|alerts/.test(blockCatch));

const slice = Number((/[A-Za-z_]*[Aa]lerts\w*\??\.slice\(0,\s*(\d+)\)/.exec(src) || [])[1] || 0);
say("PAGE_SLICES_ALERTS_TO=" + slice);
say("PAGE_PRINTS_HOW_MANY_ARE_HIDDEN=" + /hiddenWatcher/.test(src));
say("PAGE_ALERT_NAMED_SOURCES=" + [...src.matchAll(/source:\s*["'`][^"'`]+["'`]/g)].length);
say("PAGE_LEDGER_ROWS_COME_FROM_THE_DOOR=" + /aJson\.data/.test(src));

// Arabic copy that carries digits. Two different defects, counted apart:
//   typed — the number is written in the sentence itself, so it is Latin whatever the door says
//   interpolated — a door's number is printed raw instead of through the Arabic digit rule
const arabicStrings = [...src.matchAll(/["'`]([^"'`\n]{3,140})["'`]/g)]
  .map((m) => m[1])
  .filter((s) => /[؀-ۿ]/.test(s));
const typedLatin = arabicStrings.filter((s) => /[0-9]/.test(s.replace(/\$\{[^}]*\}/g, "")));
const rawInterpolations = arabicStrings.filter(
  (s) => /\$\{[^}]*\}/.test(s) && !/arNum|arDigits|toLocaleString/.test(s)
);
say("PAGE_ARABIC_STRINGS=" + arabicStrings.length);
say("PAGE_TYPED_LATIN_DIGITS=" + typedLatin.length + " :: " + typedLatin.slice(0, 6).join(" | "));
say("PAGE_RAW_INTERPOLATED_NUMBERS=" + rawInterpolations.length + " :: " + rawInterpolations.slice(0, 6).join(" | "));

// the links the alerts send him to
const links = [...new Set([...src.matchAll(/link:\s*["'`](\/[^"'`]+)["'`]/g)].map((m) => m[1]))];
const missing = links.filter((l) => {
  const p = l.replace(/^\//, "").split("/").join("/");
  return !fs.existsSync("app/" + p + "/page.tsx") && !fs.existsSync("app/" + p + "/page.js");
});
say("PAGE_ALERT_LINKS=" + links.length + " :: " + links.join(","));
say("PAGE_ALERT_LINKS_WITH_NO_PAGE=" + missing.length + " :: " + missing.join(","));

// ---------- 3. ask the record what each side claims right now ----------
if (RECORD) {
  fs.writeFileSync(process.env.PAGE_OUT ?? "scratch/measure-admin-alerts.out", out.join("\n") + "\n");
  process.exit(0);
}
const sql = postgres(process.env.DIRECT_URL, { max: 1 });

const saCols = await sql`
  select column_name from information_schema.columns
  where table_schema='public' and table_name='system_alerts'`;
say("SYSTEM_ALERTS_COLUMNS=" + saCols.length);

let saRows = -1;
let saPending = -1;
let saLast = "ABSENT";
if (saCols.length) {
  saRows = (await sql`select count(*)::int n from system_alerts`)[0].n;
  saPending = (await sql`select count(*)::int n from system_alerts where status = 'pending'`)[0].n;
  saLast = String((await sql`select max(last_seen_at) m from system_alerts`)[0].m);
}
say("SYSTEM_ALERTS_ROWS=" + saRows + " PENDING=" + saPending + " LAST_SEEN=" + saLast);

const STATS = "app/api/admin/mastermind/stats/route.ts";
const statsSrc = fs.readFileSync(STATS, "utf8");
const flQuery = /\.from\("failed_login_attempts"\)([\s\S]{0,220}?),\n/.exec(statsSrc)?.[1] || "";
const flColumns = [...new Set([...flQuery.matchAll(/\.(?:select|eq|gte|lt|order)\("([a-z_, ]+)"?/g)].flatMap((m) => m[1].split(",").map((c) => c.trim())))];
say("FAILED_LOGIN_QUERY_COLUMNS=" + flColumns.length + " :: " + flColumns.join(","));

const flCols = await sql`
  select column_name from information_schema.columns
  where table_schema='public' and table_name='failed_login_attempts'`;
const flReal = flCols.map((r) => r.column_name);
say("FAILED_LOGIN_TABLE_COLUMNS=" + flCols.length + " :: " + flReal.join(","));
const flPhantom = flColumns.filter((c) => c && !flReal.includes(c));
say("FAILED_LOGIN_QUERY_NAMES_WHAT_THE_TABLE_HASNT=" + flPhantom.length + " :: " + flPhantom.join(","));

let fl24 = -1;
const flTimeCol = flReal.find((c) => /at$|_time|timestamp/.test(c));
if (flTimeCol === "attempted_at") {
  fl24 = (await sql`select count(*)::int n from failed_login_attempts where attempted_at > now() - interval '24 hours'`)[0].n;
} else if (flTimeCol) {
  fl24 = (await sql`select count(*)::int n from failed_login_attempts`)[0].n;
}
say("FAILED_LOGIN_TIME_COLUMN=" + (flTimeCol || "none"));
say("FAILED_LOGIN_IN_24H=" + fl24);

const typeList = types.join(",");
const ledgerByCompany = await sql`
  select e.company_id, count(*)::int n
  from ops_sync_events e
  where e.event_type = any(string_to_array(${typeList}, ','))
    and e.created_at >= now() - ${windowMs} * interval '1 millisecond'
    and not exists (
      select 1 from ops_sync_events a
      where a.event_type = 'owner_alert_acknowledged'
        and (a.payload->>'alert_id')::int = e.id
    )
  group by e.company_id`;
const ledgerOpen = ledgerByCompany.reduce((sum, r) => sum + r.n, 0);
say("LEDGER_OPEN_IN_WINDOW=" + ledgerOpen + " BY_COMPANY=" + JSON.stringify(ledgerByCompany));

const ledgerTotal = (await sql`select count(*)::int n from ops_sync_events`)[0].n;
say("LEDGER_TOTAL_ROWS=" + ledgerTotal);

const pageWouldShow = Math.min(saPending < 0 ? 0 : saPending, slice || 99) + (fl24 > 0 ? 1 : 0);
say("PAGE_WOULD_SHOW=" + pageWouldShow + " LEDGER_SAYS=" + ledgerOpen + " DISAGREE=" + (pageWouldShow !== ledgerOpen));
say("PAGE_HIDES_ALERTS_OLDER_THAN_THE_WINDOW=" + (saPending > slice));

fs.writeFileSync("scratch/measure-admin-alerts.out", out.join("\n") + "\n");
await sql.end();
