import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";
dotenv.config({ path: ".env.local" });
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>/^[A-Z]/.test(l)&&l.includes("=")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).replace(/^"|"$/g,"").trim()]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: sheet } = await sb.from("room_sketches").select("id,token,pulse_sent_at").is("pulse_sent_at", null).order("id",{ascending:false}).limit(1).maybeSingle();
if (!sheet) { console.log("مفيش ورقة من غير ختم"); process.exit(0); }
console.log(`ورقة بلا ختم: id=${sheet.id} token=${sheet.token.slice(0,6)}…`);

const now = new Date().toISOString();
const { error } = await sb.from("room_sketches").update({ pulse_sent_at: now }).eq("id", sheet.id);
console.log(`محاولة الكتابة: ${error ? "رُفضت — " + error.message : "اتقبلت"}`);

const { data: back } = await sb.from("room_sketches").select("pulse_sent_at").eq("id", sheet.id).maybeSingle();
console.log(`قراية من القاعدة: ${back?.pulse_sent_at ?? "فاضي"}`);

if (error) {
  const { data: cons } = await sb.from("room_sketches").select("id").limit(0);
  console.log(`كود الخطأ: ${error.code ?? "?"} · تفاصيل: ${error.details ?? "—"}`);
}
