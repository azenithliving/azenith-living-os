import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Where does the store's Telegram notice actually go?
 *   node scratch/probe-telegram-channel.mjs [--send]
 *
 * The owner says nothing arrived, while the store stamped a sheet as reported — so either the API
 * refused and the code called that a success, or the message is landing in a chat that is not his.
 * This reads the same two sources the app reads (the stored panel config, then the environment),
 * asks the bot who it is, asks what chats have ever spoken to it, and — with --send — delivers one
 * message and prints the API's own answer.
 *
 * Nothing secret is printed: the token is reported only by length, and chat ids only by their last
 * four characters.
 */
const SEND = process.argv.includes("--send");
/** Deliver one marker to a specific chat instead of the configured default: --to=…7315 style tail. */
const toArg = (process.argv.find((a) => a.startsWith("--to=")) ?? "").slice(5);
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const tail = (v) => (v ? `…${String(v).slice(-4)}` : "(empty)");
const api = (token, method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: row, error: rowError } = await supabase
  .from("site_settings")
  .select("value,updated_at")
  .eq("key", "telegram_config")
  .maybeSingle();

console.log("panel row in the store:", row ? "present" : "absent", rowError ? JSON.stringify(rowError) : "");

const stored = row?.value ?? {};
const storedChats = Array.isArray(stored.chats) ? stored.chats : [];
const storedDefault = storedChats.find((c) => c.isDefault) ?? storedChats[0];

/** The app's own precedence: the stored panel config wins whenever it carries a token. */
const usingDB = Boolean(stored.botToken);
const token = usingDB ? stored.botToken : env.TELEGRAM_BOT_TOKEN;
const chatId = usingDB ? (storedDefault?.chatId ?? "") : env.TELEGRAM_CHAT_ID;
const enabled = usingDB ? stored.enabled !== false : env.TELEGRAM_ENABLED === "true";

console.log("config the app would use:", usingDB ? "the panel row" : "the environment");
console.log("  enabled:", enabled, "· token length:", String(token ?? "").length, "· default chat:", tail(chatId));
console.log("  chats stored:", storedChats.length, storedChats.map((c) => `${c.label || "?"}=${tail(c.chatId)}${c.isDefault ? " (default)" : ""}`).join(" · "));
console.log("  env chat:", tail(env.TELEGRAM_CHAT_ID), "· env enabled:", JSON.stringify(env.TELEGRAM_ENABLED));
if (usingDB && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN !== stored.botToken) {
  console.log("  note: the stored panel token is a DIFFERENT bot from the environment token.");
}
if (!token || !chatId) {
  console.log("cannot probe: no token or no chat id.");
  process.exit(1);
}

const me = await api(token, "getMe");
const meBody = await me.json().catch(() => ({}));
console.log("getMe — http", me.status, "· ok:", meBody.ok, "· bot:", meBody.result?.username ?? "(none)", "· id:", meBody.result?.id);

const updates = await api(token, "getUpdates", undefined);
const upBody = await updates.json().catch(() => ({}));
const chats = new Map();
for (const u of upBody.result ?? []) {
  const c = u.message?.chat ?? u.my_chat_member?.chat ?? u.edited_message?.chat;
  if (c) chats.set(`${c.id}`, `${c.type} first=${(c.first_name ?? "?").slice(0, 16)}`);
}
console.log("getUpdates — http", updates.status, "· ok:", upBody.ok, upBody.description ? `· ${upBody.description}` : "");
console.log("  chats that ever spoke to this bot:", chats.size ? [...chats].map(([id, who]) => `${tail(id)} ${who}`).join(" · ") : "none");
if (upBody.ok === false) console.log("  (getUpdates is refused when a webhook owns the bot — that alone does not break sending)");

const configuredIsKnown = [...chats.keys()].some((id) => id === String(chatId));
console.log("  configured chat id appears among the bots's known chats:", configuredIsKnown);

const hook = await api(token, "getWebhookInfo");
const hookBody = await hook.json().catch(() => ({}));
console.log(
  "getWebhookInfo — url:", hookBody.result?.url || "(none — the bot polls, so getUpdates above is the whole history)",
  "· pending:", hookBody.result?.pending_update_count ?? "—",
  hookBody.result?.last_error_message ? `· last error: ${hookBody.result.last_error_message}` : ""
);

/** Who owns each configured address: a private chat, a group, or a channel he never opens. */
for (const candidate of [...new Set([...storedChats.map((c) => c.chatId), env.TELEGRAM_CHAT_ID].filter(Boolean))]) {
  const chat = await api(token, "getChat", { chat_id: candidate });
  const chatBody = await chat.json().catch(() => ({}));
  const r = chatBody.result ?? {};
  console.log(
    `getChat ${tail(candidate)} — ${chatBody.ok ? "answers" : `refuses: ${chatBody.description}`}`,
    `· type: ${r.type ?? "—"}`,
    r.username ? `· @${r.username.slice(0, 3)}…` : "",
    r.first_name ? `· private chat with ${r.first_name.slice(0, 2)}…` : "",
    r.title ? `· titled ${r.title.slice(0, 3)}…` : ""
  );
}

if (SEND) {
  const allCandidates = [...new Set([...storedChats.map((c) => c.chatId), env.TELEGRAM_CHAT_ID, chatId].filter(Boolean))].map(String);
  const target = toArg ? allCandidates.find((id) => id.endsWith(toArg)) : chatId;
  if (!target) {
    console.log(`--to=${toArg} matched no configured chat (tails: ${allCandidates.map((id) => tail(id)).join(" ")})`);
    process.exit(1);
  }
  const sent = await api(token, "sendMessage", {
    chat_id: target,
    text: " اختبار قناة التنبيه من المتجر — لو شوفت الرسالة دي يبقى الطريق مفتوح.",
    disable_web_page_preview: true,
  });
  const sentBody = await sent.json().catch(() => ({}));
  console.log(
    "sendMessage →",
    tail(target),
    "— http", sent.status,
    "· ok:", sentBody.ok,
    "· error_code:", sentBody.error_code ?? "—",
    "· description:", sentBody.description ?? "—",
    "· message_id:", sentBody.result?.message_id ?? "—",
    "· landed in chat:", tail(sentBody.result?.chat?.id)
  );
  console.log("  the app's own check reads the HTTP status only, so http 200 would have been called a success even with ok:false.");
}
