import fs from "fs";

const p = new URL("../components/admin/UnifiedAssistant.tsx", import.meta.url);
let t = fs.readFileSync(p, "utf8");

if (!t.includes("SovereignMindPanel")) {
  t = t.replace(
    "import {\n  Bot,",
    "import { SovereignMindPanel } from '@/components/admin/SovereignMindPanel';\nimport {\n  Bot,"
  );
}

const D = "d" + "iv";
t = t.replace(
  '<aside className="lg:col-span-4 flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] min-h-[280px]">',
  `<aside className="lg:col-span-4 flex flex-col gap-4 min-h-[280px]">
            <SovereignMindPanel />
            <${D} className="flex flex-col flex-1 rounded-2xl border border-white/10 bg-white/[0.02] min-h-0">`
);

t = t.replace(
  "            </motion>\n          </aside>",
  `            </${D}>\n            </${D}>\n          </aside>`
);

if (!t.includes("SovereignMindPanel />")) {
  t = t.replace(
    "            </motion>\n          </aside>",
    `            </${D}>\n            </${D}>\n          </aside>`
  );
}

if (!t.includes("<SovereignMindPanel")) {
  console.error("patch failed");
  process.exit(1);
}

fs.writeFileSync(p, t);
console.log("patched");
