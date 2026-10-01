// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  senderDisplayName,
  LEADER_TITLE,
  agentLabel,
  AGENT_KEYS,
} from "@/lib/ops/identity";

/**
 * `agent_messages.sender_name` stores the key upper-cased, and the chat surfaces
 * printed that column straight to the screen — so the owner's Arabic conversation
 * was labelled «OPS-LEAD», and every message written before P7 still reads
 * «QAYYIM-CORE». The stored shape is the migration's record and must not change;
 * the displayed shape is the owner's screen and must be a role.
 *
 * `senderDisplayName` is the one mapping between them.
 */
describe("a message is signed with the role, not the key", () => {
  it("turns the live key into the leader's job title", () => {
    expect(senderDisplayName("OPS-LEAD")).toBe(LEADER_TITLE);
    expect(senderDisplayName("ops-lead")).toBe(LEADER_TITLE);
  });

  /**
   * This is the half a rename always forgets: rows written before the rename stay
   * in the table forever. A retired stamp must read as the live role, or the owner
   * scrolls through history and meets the dead name again in every old bubble.
   */
  it("reads a retired stamp from stored history as the live role", () => {
    for (const [key, ops] of [
      ["QAYYIM-CORE", "ops-lead"],
      ["QAYYIM-UX", "ops-ux"],
      ["qayyim-qa", "ops-qa"],
      ["QAYYIM-DEV", "ops-dev"],
    ] as const) {
      expect(senderDisplayName(key), key).toBe(agentLabel(ops));
    }
  });

  it("names every member of the swarm by its role", () => {
    for (const key of AGENT_KEYS) {
      expect(senderDisplayName(key.toUpperCase())).toBe(agentLabel(key));
    }
  });

  /**
   * Unchanged input is the safe answer for anything that is not a swarm key: the
   * owner's own label, the system label, and the field agents, who belong to a
   * different product and are not this rename's business.
   */
  it("leaves anything that is not a swarm key exactly as it came", () => {
    for (const other of ["أنت", "النظام", "VANGUARD", "Analyst", "", "You"]) {
      expect(senderDisplayName(other), JSON.stringify(other)).toBe(other);
    }
  });

  /**
   * The mapping belongs to the render, not to what gets written: both chat surfaces
   * print a sender, and a surface that prints the raw column re-opens the defect.
   *
   * The sales surface wraps the call in its own signature line, because the owner
   * renamed the sales employee on ٣٠ سبتمبر and that title belongs to the chat surface
   * rather than to the swarm's eight keys. The wrapper is only legal because it delegates
   * here first — so the guard checks the delegation instead of one exact expression.
   */
  it("is what both chat surfaces print", () => {
    const prints: Record<string, RegExp> = {
      "components/admin/agents/ChatPanel.tsx": /\{(senderDisplayName|signedAs)\(message\.sender_name\)\}/,
      "components/admin/agents/GroupChatView.tsx": /\{senderDisplayName\(message\.sender_name\)\}/,
    };
    for (const [file, shape] of Object.entries(prints)) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must import it`).toContain("senderDisplayName");
      expect(src, `${file} must print it`).toMatch(shape);
    }
    const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
    const wrapper = panel.slice(panel.indexOf("function signedAs("));
    expect(wrapper.slice(0, 500), "the wrapper would print a raw key").toContain("senderDisplayName(stored)");
  });
});
