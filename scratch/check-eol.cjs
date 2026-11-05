const fs = require("fs");
const files = [
  "lib/sentinel.ts",
  "lib/sentinel-report.ts",
  "app/admin/database/page.tsx",
  "app/api/system-health/route.ts",
  "app/admin/page.tsx",
];
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  const crlf = text.split("\r\n").length - 1;
  const lf = text.split("\n").length - 1;
  console.log(`${f} lines=${lf} crlf=${crlf} blank=${text.split(/\r?\n/).filter((l) => l.trim() === "").length}`);
}
