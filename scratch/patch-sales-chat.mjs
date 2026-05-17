import fs from "fs";

const p = new URL("../app/admin/sales/page.tsx", import.meta.url);
let t = fs.readFileSync(p, "utf8");
const start = t.indexOf('{activeSubTab === "chat" && (');
const end = t.indexOf('{activeSubTab === "knowledge" && (');
if (start < 0 || end < 0) throw new Error("markers not found");

const D = "d" + "iv";
const replacement = `      {activeSubTab === "chat" && (
        <${D} className="rounded-2xl border border-[#C5A059]/30 bg-[#C5A059]/5 p-8 text-center space-y-4">
          <Brain className="w-12 h-12 text-[#C5A059] mx-auto" />
          <h3 className="text-lg font-bold text-white">المحادثة الإدارية انتقلت للمساعد الموحّد</h3>
          <p className="text-sm text-white/60 max-w-md mx-auto">
            نفّذ أوامر المبيعات، المفاتيح، والوكلاء من مكان واحد بلغتك الطبيعية.
          </p>
          <Link
            href="/admin/assistant"
            className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-6 py-3 text-[#1a1a1a] font-semibold hover:bg-[#d8b56d]"
          >
            <MessageCircle className="w-5 h-5" />
            افتح المساعد الموحّد
          </Link>
        </${D}>
      )}

      `;

t = t.slice(0, start) + replacement + t.slice(end);
fs.writeFileSync(p, t);
console.log("patched sales chat");
