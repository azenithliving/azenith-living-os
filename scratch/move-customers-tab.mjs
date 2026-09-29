// One-time mechanical move: the customers employee leaves the stacked sales page.
// Nothing inside the 813 lines is rewritten — the body is copied verbatim so the
// transfer is a pure move and the behaviour is provably unchanged.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const PAGE = "app/admin/sales/page.tsx";
const OUT = "components/admin/sales/CustomersPanel.tsx";
const src = readFileSync(PAGE, "utf8").split("\n");

// 1-based inclusive line numbers, verified before slicing.
const TAB_START = 584;
const TAB_END = 1396;
const TYPE_START = 45;
const TYPE_END = 75;
if (!src[TAB_START - 1].startsWith("function LeadsTab")) throw new Error(`line ${TAB_START} is not the tab head`);
if (src[TAB_END - 1].trim() !== "}") throw new Error(`line ${TAB_END} is not the tab tail`);
if (!src[TYPE_START - 1].startsWith("interface Lead")) throw new Error(`line ${TYPE_START} is not the Lead type`);
if (src[TYPE_END - 1].trim() !== "}") throw new Error(`line ${TYPE_END} is not the Lead tail`);

const body = src.slice(TAB_START, TAB_END - 1).join("\n");
const leadType = src.slice(TYPE_START - 1, TYPE_END).join("\n");

const header = `"use client";

/**
 * The customers employee — moved out of the stacked sales page on 2026-09-29.
 *
 * This is a pure transfer: the body is the tab that used to live at
 * \`app/admin/sales/page.tsx:584-1396\`, line for line. It is the first employee the
 * consolidation program moves after the contract froze, and it moves alone on
 * purpose — the page it came from holds four other things that belong to other
 * offices. Read \`docs/ledger/contract.md\` section ١٠ before adding capability here.
 */
import { useState, useEffect } from "react";
import { Brain, Check, Send, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { summarizeInterest } from "@/lib/lead-insights";
import { LEDGER_LABELS, LEDGER_ORDER, type LedgerTotals } from "@/lib/leads-delete-guard";

${leadType}

export default function CustomersPanel() {
`;
mkdirSync("components/admin/sales", { recursive: true });
writeFileSync(OUT, header + body + "\n}\n", "utf8");

// Remove the tab and the type from the page, and point the tab entry at the panel.
const kept = [
  ...src.slice(0, TYPE_START - 1),
  ...src.slice(TYPE_END),
];
const shifted = kept.map((l) => l);
// Drop the tab body: recompute its bounds in the trimmed file.
const head = shifted.findIndex((l) => l.startsWith("function LeadsTab"));
if (head < 0) throw new Error("LeadsTab head not found after trimming");
let depth = 0;
let end = -1;
for (let i = head; i < shifted.length; i++) {
  depth += (shifted[i].match(/{/g) ?? []).length;
  depth -= (shifted[i].match(/}/g) ?? []).length;
  if (depth === 0 && i > head) { end = i; break; }
}
if (end < 0) throw new Error("LeadsTab tail not found");
shifted.splice(head, end - head + 1);

const out = shifted.join("\n")
  .replace(
    'import { LEDGER_LABELS, LEDGER_ORDER, type LedgerTotals } from "@/lib/leads-delete-guard";',
    'import CustomersPanel from "@/components/admin/sales/CustomersPanel";',
  )
  .replace("{ id: \"leads\", label: \"العملاء\", icon: Users, component: LeadsTab }", "{ id: \"leads\", label: \"العملاء\", icon: Users, component: CustomersPanel }");
writeFileSync(PAGE, out, "utf8");

console.log(`moved ${body.split("\n").length} lines into ${OUT}`);
console.log(`page went from ${src.length} to ${out.split("\n").length} lines`);
