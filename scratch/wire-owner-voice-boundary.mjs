import { readFileSync, writeFileSync } from "node:fs";

/**
 * Puts the owner-voice boundary on the four surfaces that print a stored column straight out.
 *
 * Each edit is anchored on one exact line and verified by reading the result back out of the written
 * text — the failure mode this project keeps hitting is a patch script that reports a count taken from
 * its plan instead of the file.
 */
/** @type {[string, string, string, string][]} */
const EDITS = [
  [
    "app/admin/v2/sketches/page.tsx",
    `{!row.ok && row.failure && <p className="mt-1 text-[10px] text-rose-200">{ownerVoice(row.failure)}</p>}`,
    `{!row.ok && row.failure && <p className="mt-1 text-[10px] text-rose-200">{ownerVoice(row.failure)}</p>}`,
    `import { ownerVoice } from "@/lib/ops/owner-voice";`,
  ],
  [
    "components/admin/agents/TaskQueue.tsx",
    `<p className="font-medium text-gray-900">{task.title}</p>`,
    `<p className="font-medium text-gray-900">{ownerVoice(task.title)}</p>`,
    `import { ownerVoice } from '@/lib/ops/owner-voice';`,
  ],
  [
    "components/admin/agents/AgentActionsFeed.tsx",
    `<p className="text-xs text-white/80 mt-0.5 truncate">{item.title}</p>`,
    `<p className="text-xs text-white/80 mt-0.5 truncate">{ownerVoice(item.title)}</p>`,
    `import { ownerVoice } from '@/lib/ops/owner-voice';`,
  ],
  [
    "components/admin/agents/ApprovalDecisionBlock.tsx",
    `{row.description || row.metadata?.userMessage || 'اقتراح من السرب'}`,
    `{ownerVoice(row.description || row.metadata?.userMessage || 'اقتراح من السرب')}`,
    `import { ownerVoice } from '@/lib/ops/owner-voice';`,
  ],
];

const failures = [];
for (const [file, from, to, imp] of EDITS) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    failures.push(`no such file: ${file}`);
    continue;
  }
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const hits = text.split(from).length - 1;
  if (hits !== 1 && !(file.includes("sketches") && hits === 1)) {
    failures.push(`${file}: anchor found ${hits} times`);
    continue;
  }
  let next = text.replace(from, to);
  if (!next.includes(imp)) {
    // After the last COMPLETE single-line import. The first run of this script inserted after the
    // opener of a multi-line `import {` statement and produced a syntax error in that file — a
    // statement fragment is not a line to append after.
    const lines = next.split(eol);
    let at = -1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^import\s/.test(l) && !/[,{]\s*$/.test(l)) at = i;
    }
    if (at < 0) {
      failures.push(`${file}: no import block found`);
      continue;
    }
    lines.splice(at + 1, 0, imp);
    next = lines.join(eol);
  }
  if (!next.includes(to) || !next.includes(imp)) {
    failures.push(`${file}: result missing the edit or the import`);
    continue;
  }
  writeFileSync(file, next, "utf8");
  console.log(`${file}: boundary wired`);
}

if (failures.length) {
  console.log("PROBLEMS:");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("done");
