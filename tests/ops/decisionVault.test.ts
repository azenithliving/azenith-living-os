// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { toolLabel, type PendingApproval } from "@/components/admin/agents/ApprovalGate";
import { METRIC_LABELS, arNum, metricLabel } from "@/lib/ops/metricLabels";

const row = (over: Partial<PendingApproval>): PendingApproval => ({
  id: "apr_1",
  action_type: "run_tool",
  description: "تقرير قرار قبل الموافقة",
  risk_level: "normal",
  status: "pending",
  ...over,
});

/**
 * The vault is the one surface where a decision is put in front of the owner, so a
 * machine identifier reaching it is the defect his own rule names: Latin inside an
 * Arabic sentence arrives scrambled on his phone. An unknown tool therefore says
 * nothing at all — the description above it is already Arabic and already real.
 */
describe("the decisions vault speaks only the owner's language", () => {
  it("names a known request with its Arabic label", () => {
    expect(toolLabel(row({ metadata: { toolName: "backup_create" } }))).toBe(
      "أخذ نسخة احتياطية دلوقتي"
    );
  });

  it("stays silent rather than printing a tool identifier", () => {
    expect(toolLabel(row({ metadata: { toolName: "zzz_unlisted_tool" } }))).toBe("");
    expect(toolLabel(row({}))).toBe("");
  });

  it("hangs the vault inside the cockpit, not only in the old house", () => {
    const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
    expect(panel).toContain("data-decisions-toggle");
    expect(panel).toContain("data-decision-vault");
    expect(panel).toContain("<ApprovalGate onCount={setPendingDecisions} />");
  });

  it("names a tool's numbers in Arabic, or not at all", () => {
    const latin = Object.entries(METRIC_LABELS).filter(([, v]) => /[A-Za-z]/.test(v));
    expect(latin.map(([k, v]) => `${k}=${v}`)).toEqual([]);
    expect(metricLabel("agents")).toBe("عدد الموظفين");
    expect(metricLabel("a_key_no_one_named")).toBe("");
    expect(arNum(25)).toBe("٢٥");
  });

  it("counts in Arabic numerals wherever the owner reads a number", () => {
    const surfaces: [string, string][] = [
      ["components/admin/agents/ApprovalGate.tsx", "arNum(approvals.length)"],
      ["components/admin/agents/EmergencyBanner.tsx", "arNum(count)"],
      ["components/admin/CockpitDoors.tsx", "arNum(waiting)"],
      ["components/admin/v2/CommandCanvas.tsx", "arNum(DEPARTMENT_KEYS.length)"],
      // Measured on the published site 2026-10-03: the owner's home card painted «53», «49s»
      // and the machine key «OPS-UX» where the swarm's own module already had the Arabic name.
      ["app/admin/page.tsx", "arNum(tasksCompleted)"],
      ["app/admin/page.tsx", "agentLabel(agentKey)"],
      // Measured on the published site 2026-10-05: the quality card on the owner's main screen
      // painted «2», «0», «67%» in Latin digits while the same page's other card was already fixed.
      ["app/admin/page.tsx", "arNum(metrics.pass_count)"],
      ["app/admin/page.tsx", "arNum(metrics.pass_rate)"],
      ["app/admin/page.tsx", "arNum(metrics.total_checks)"],
      ["app/admin/page.tsx", "arNum(metrics.final_count)"],
      ["app/admin/intel/components/ImageHarvestDashboard.tsx", "arNum(data.stats.distribution.length)"],
    ];
    for (const [file, call] of surfaces) {
      expect(readFileSync(file, "utf8"), `${file} prints Latin digits at ${call}`).toContain(call);
    }
  });

  it("anchors the actions drawer inside the chat, not on the page", () => {
    const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
    const drawer = panel.slice(panel.indexOf("data-actions-drawer"));
    expect(drawer).toBeTruthy();
    // A page-level fixed layer fights the cockpit's own stacking order — the chat
    // already sits above the dashboard shell, and an overlay outside it can be
    // painted under it. Inside the relative chat box, that cannot happen.
    expect(drawer.slice(0, 300)).toContain("absolute inset-y-0");
    expect(drawer.slice(0, 300)).not.toContain("fixed");
    expect(panel).toContain("<QuickActionsPanel />");
  });

  it("keeps the cockpit header inside a phone's width", () => {
    const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
    // Every header word is hidden below `sm`, leaving the icon and the live badge:
    // the row measured 696px wide on a 390px screen before this.
    const header = panel.slice(panel.indexOf('data-chat-header'));
    const words = ["أوامر", "نفسك", "أدوار", "قرارات"];
    for (const word of words) {
      expect(header, `«${word}» still shows its label on a phone`).toContain(
        `hidden sm:inline">${word}`
      );
    }
  });

  it("counts the waiting decisions in his numerals", () => {
    // Seen on the published cockpit at 390px 2026-10-06: the red badge over the decisions door read
    // «30» while every other number on his screens had been moved to Arabic-Indic digits.
    const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
    const badge = panel.slice(panel.indexOf('data-decisions-count'));
    expect(badge.slice(0, 320)).toContain("{arDigits(pendingDecisions)}");
    expect(badge.slice(0, 320)).not.toContain("{pendingDecisions}");
    expect(panel).toContain("import { arDigits, arNum, metricLabel } from '@/lib/ops/metricLabels';");
  });
});
