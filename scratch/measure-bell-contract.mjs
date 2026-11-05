/**
 * measure-bell-contract.mjs — what the second bell promises versus what the alert door answers.
 *
 * The cockpit has one live alert surface (NotificationsPanel) built over the ledger rule.
 * NotificationBell is a second one, on no screen, still written against the contract the door
 * had before it was re-pointed: it declares fields the door never sends, ignores the fields the
 * door does send, and its "mark read" believes itself without reading the door's reply.
 * This measures the gap in numbers, then asks the record what the dead realtime channel
 * could ever have delivered.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import postgres from "postgres";

for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) dotenv.config({ path: f });

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

const BELL = process.env.BELL_FILE ?? "components/admin/NotificationBell.tsx";
const DOOR = "app/api/admin/notifications/route.ts";
const DAL = "lib/dal/unified-supabase.ts";
const RECORD = process.env.NO_RECORD === "1";

function interfaceFields(src) {
  const m = /interface\s+[A-Za-z_][A-Za-z0-9_]*\s*\{([\s\S]*?)\n\}/.exec(src);
  if (!m) return [];
  return [...m[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/gm)].map((x) => x[1]);
}

/** Callers must be real code: a doc comment naming a component is not a mount. */
function withoutComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

// ---------- 1. the bell's declared contract vs the door's answered contract ----------
const bell = fs.readFileSync(BELL, "utf8");
const bellCode = withoutComments(bell);
const door = fs.readFileSync(DOOR, "utf8");

const declared = interfaceFields(bell);

// The door builds each row with an object literal inside read.alerts.map(...)
const mapBlock = /read\.alerts\.map\(\([\s\S]*?\{([\s\S]*?)\}\)\)/.exec(door);
const answered = mapBlock
  ? [...mapBlock[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map((x) => x[1])
  : [];
const envelope = [...door.matchAll(/return NextResponse\.json\(\{([\s\S]*?)\}\);/g)]
  .flatMap((m) => [...m[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map((x) => x[1]));

say("BELL_DECLARED_FIELDS=" + declared.length + " :: " + declared.join(","));
say("DOOR_ROW_FIELDS=" + answered.length + " :: " + answered.join(","));
say("DOOR_ENVELOPE_FIELDS=" + [...new Set(envelope)].join(","));

const phantom = declared.filter((f) => !answered.includes(f));
say("BELL_DECLARES_WHAT_DOOR_NEVER_ANSWERS=" + phantom.length + " :: " + phantom.join(","));

// Does the bell ever read the envelope fields the door sends — from the reply, not its own state?
const ignored = ["unreadCount", "restingLine"].filter((f) => !new RegExp("data\\." + f + "\\b").test(bellCode));
say("DOOR_SENDS_WHAT_BELL_IGNORES=" + ignored.length + " :: " + ignored.join(","));

// ---------- 2. what the bell says when there is nothing, and what it claims it can do ----------
const emptyStates = [...bell.matchAll(/>([^<>{}]*(?:لا توجد|مفيش|إشعارات|التنبيهات)[^<>{}]*)</g)].map((m) => m[1].trim());
say("BELL_HARDOWN_LINES=" + emptyStates.length + " :: " + emptyStates.join(" | "));

const buttons = [...bell.matchAll(/<button[\s\S]*?className=([\s\S]*?)<\/button>/g)].length;
say("BELL_BUTTON_COUNT=" + buttons);
const fakeFooter = /onClick=\{\(\)\s*=>\s*\{\s*setIsOpen\(false\);\s*\}\}/.test(bell);
say("BELL_FOOTER_BUTTON_ONLY_CLOSES=" + fakeFooter);
say("BELL_FOOTER_LABEL=" + ((/>(\s*عرض جميع الإشعارات\s*)</.exec(bell) || [])[1] || "none"));

// Mark-read: does the bell look at the door's reply before claiming success?
const markBlock = /async function markAllRead\(\)([\s\S]*?)\n  \}/.exec(bell);
const markSrc = markBlock ? markBlock[1] : "";
const readsReply = /res\.ok|data\.success|await res\.json\(\)/.test(markSrc);
say("BELL_MARK_READ_CHECKS_DOOR_REPLY=" + readsReply);
const optimistic = /read:\s*true/.test(bellCode);
say("BELL_MARK_READ_WRITES_LOCAL_FLAG=" + optimistic);

// Latin digits rendered on his screen?
say("BELL_RENDERED_DIGITS_ARE_ARABIC=" + /arNum|arDigits/.test(bellCode));
say("BELL_BADGE_LATIN_BRANCH=" + /unreadCount > 9 \? '9\+' : unreadCount/.test(bellCode));

// request size vs shown size
const asked = Number((/limit=(\d+)/.exec(bellCode) || [])[1] || 0);
const sliced = Number((/\.slice\(0,\s*(\d+)\)/.exec(bellCode) || [])[1] || 0);
const showsAll = /\.map\(/.test(bellCode) && !sliced;
say("BELL_ASKS=" + asked + " BELL_SLICES_TO=" + (sliced || "no slice") + " SHOWS_EVERY_ROW_RETURNED=" + showsAll);
const pollMs = Number((/setInterval\(\s*[A-Za-z_]\w*\s*,\s*(\d+)\)/.exec(bellCode) || [])[1] || 0);
say("BELL_POLL_MS=" + pollMs);

// ---------- 3. who mounts the bell, and who calls the realtime channel ----------
function sourceFiles() {
  const list = [];
  const roots = ["app", "lib", "components", "scripts", "services", "tests"];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) list.push(full);
      }
    };
    walk(root);
  }
  return list;
}

const files = sourceFiles();
say("SCANNED_SOURCE_FILES=" + files.length);

const selfPaths = [BELL, DOOR, DAL].map((p) => path.normalize(p));
function callersOf(labelRe, excludeSelf) {
  const hits = [];
  for (const f of files) {
    if (excludeSelf && path.normalize(f) === path.normalize(excludeSelf)) continue;
    const src = withoutComments(fs.readFileSync(f, "utf8"));
    if (labelRe.test(src)) hits.push(f);
  }
  return hits;
}

/** A file that declares the symbol is not a surface mounting it — and a doc comment is not code. */
function references(name) {
  const defined = new RegExp("export (?:function|const) " + name + "\\b");
  return callersOf(new RegExp(name), null).filter((f) => !defined.test(withoutComments(fs.readFileSync(f, "utf8"))));
}

const onScreens = (list) => list.filter((f) => /^(app|components|services)[\\/]/.test(f.replace(/\\/g, "/")));

const bellRefs = references("NotificationBell");
say("BELL_REFERENCED_BY=" + bellRefs.length + " :: " + bellRefs.join(","));
const bellScreens = onScreens(bellRefs);
say("BELL_MOUNTED_AT=" + bellScreens.length + " :: " + bellScreens.join(","));

const dalImport = path.basename(DAL).replace(".ts", "");
const dalFiles = files.filter((f) => new RegExp(dalImport).test(f) && path.normalize(f) !== path.normalize(DAL));
const realtimeCallers = [];
for (const f of dalFiles) {
  const src = fs.readFileSync(f, "utf8");
  if (/realtimeDAL|subscribeToTable|subscribeToAgentEvents/.test(src)) realtimeCallers.push(f);
}
say("DAL_FILES_IMPORTED_BY=" + dalFiles.length);
say("REALTIME_DAL_CALLERS=" + realtimeCallers.length + " :: " + realtimeCallers.join(","));

const panelCallers = onScreens(references("NotificationsPanel"));
say("LIVE_PANEL_MOUNTED_AT=" + panelCallers.length + " :: " + panelCallers.join(","));

// ---------- 4. ask the record what the dead channel could deliver ----------
if (!RECORD) {
  const sql = postgres(process.env.DIRECT_URL, { max: 1 });
  const cols = await sql`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='agent_events'`;
  say("AGENT_EVENTS_COLUMNS=" + cols.length);

  let agentRows = "ABSENT";
  let agentLast = "ABSENT";
  if (cols.length) {
    agentRows = (await sql`select count(*)::int as n from agent_events`)[0].n;
    agentLast = String((await sql`select max(created_at) as m from agent_events`)[0].m);
  }
  say("AGENT_EVENTS_ROWS=" + agentRows + " LAST_WRITE=" + agentLast);

  const ledgerCols = await sql`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='ops_sync_events'`;
  say("LEDGER_COLUMNS=" + ledgerCols.length);
  const ledgerRows = (await sql`select count(*)::int as n from ops_sync_events`)[0].n;
  const ledgerLast = String((await sql`select max(created_at) as m from ops_sync_events`)[0].m);
  say("LEDGER_ROWS=" + ledgerRows + " LAST_WRITE=" + ledgerLast);

  const published = await sql`select tablename from pg_publication_tables where pubname='supabase_realtime'`;
  const names = published.map((r) => r.tablename);
  say("REALTIME_PUBLISHED_TABLES=" + names.length);
  say("PUBLISHED_HAS_agent_events=" + names.includes("agent_events"));
  say("PUBLISHED_HAS_ops_sync_events=" + names.includes("ops_sync_events"));

  await sql.end();
}

fs.writeFileSync(process.env.BELL_OUT ?? "scratch/measure-bell-contract.out", out.join("\n") + "\n");
