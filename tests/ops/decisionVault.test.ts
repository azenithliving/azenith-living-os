// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { toolLabel, type PendingApproval } from "@/components/admin/agents/ApprovalGate";

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
});
