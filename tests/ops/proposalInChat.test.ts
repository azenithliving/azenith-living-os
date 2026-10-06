// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { isPending, pendingApprovalIdFromMessage } from "@/lib/ops/proposal-card";

/**
 * The decision belongs where he reads about it.
 *
 * Measured 2026-10-06: when the swarm needs his approval it writes the proposal, and the chat
 * message that says «أحتاج موافقتك» is stored with its text only — the door holds the proposal id in
 * hand (`brain.data.requestId`) and drops it. So the only way to answer is the card that the Telegram
 * link opens, and a decision raised inside the chat waits there unanswered.
 */
describe("the message that waits on a decision carries its number", () => {
  it("reads the id the door stored on the agent's own message", () => {
    expect(pendingApprovalIdFromMessage({ sender_type: "agent", context: { approval_id: "a1b2c3d4-9f" } })).toBe("a1b2c3d4-9f");
  });

  it("is silent for a message that asks nothing", () => {
    expect(pendingApprovalIdFromMessage({ sender_type: "agent", content: "خلصت الشغل" })).toBeNull();
    expect(pendingApprovalIdFromMessage({ sender_type: "agent", context: {} })).toBeNull();
  });

  it("never reads a decision out of the owner's own words", () => {
    expect(pendingApprovalIdFromMessage({ sender_type: "user", context: { approval_id: "a1b2c3d4-9f" } })).toBeNull();
  });

  it("refuses a value that is not shaped like an id — it goes into a query", () => {
    for (const junk of ["short", "with space", "../etc", "a".repeat(80), "", null, undefined, 42]) {
      expect(pendingApprovalIdFromMessage({ sender_type: "agent", context: { approval_id: junk as any } })).toBeNull();
    }
  });
});

describe("the wiring that puts the buttons in the message", () => {
  const door = readFileSync("app/api/admin/agents/messages/route.ts", "utf8");
  const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
  const page = readFileSync("app/admin/v2/agents/ops/page.tsx", "utf8");

  it("the door stores the proposal number with the reply it writes", () => {
    expect(door).toMatch(/approval_id/);
    expect(door).toMatch(/requires_action:\s*true/);
    // The id must come from the brain's own answer, never from what the browser sent.
    expect(door).toMatch(/brain\.data/);
  });

  it("the chat paints the decision block on the message itself", () => {
    expect(panel).toContain("pendingApprovalIdFromMessage");
    expect(panel).toContain("ApprovalDecisionBlock");
  });

  it("the Telegram link and the chat share one block, so a decision cannot look different in two places", () => {
    const card = readFileSync("components/admin/agents/ProposalDecisionCard.tsx", "utf8");
    expect(card).toContain("ApprovalDecisionBlock");
    expect(page).toContain("ProposalDecisionCard");
  });
});

/**
 * The retired identity must not survive in the new house — not even as a window global that only
 * code reads. Measured while wiring this atom: the cockpit's own send handle still wore it.
 */
describe("the retired name stays out of the cockpit", () => {
  for (const file of ["components/admin/agents/ChatPanel.tsx", "components/admin/agents/ProposalDecisionCard.tsx"]) {
    it(`${file} carries no retired identity`, () => {
      expect(readFileSync(file, "utf8").toLowerCase()).not.toContain("qayyim");
    });
  }
});

/**
 * A decision that already happened must read as a decision.
 *
 * Measured on the published cockpit 2026-10-06: after he pressed «ارفض», the block fell to «مفيش قرار
 * معلّق بهذا الرقم» — true of the pending queue, but it tells him nothing about the thing he just did,
 * and on a later visit it looks like the message broke. The queue door only ever answered with
 * pending rows, so the block had no way to know the difference.
 */
describe("a decided proposal says what was decided", () => {
  it("knows pending from anything else", () => {
    expect(isPending({ id: "x", status: "pending" })).toBe(true);
    for (const status of ["rejected", "approved", "executed", "expired", "failed", "", null, undefined]) {
      expect(isPending({ id: "x", status: status as string | null })).toBe(false);
    }
  });

  it("lets the queue door answer for one row whatever its state", () => {
    const door = readFileSync("app/api/admin/agents/approval-queue/route.ts", "utf8");
    expect(door).toMatch(/searchParams\.get\(["']id["']\)/);
    // The single-row read must not carry the pending filter, or a decided row is invisible again.
    // Bounded to the branch itself: the pending list is the next statement and legitimately filters.
    const at = door.indexOf("const oneApproval");
    const branch = door.slice(at, door.indexOf("\n    }", at));
    expect(branch.length).toBeGreaterThan(80);
    expect(branch).toContain(".eq('id'");
    expect(branch).not.toMatch(/\.eq\(['"]status['"],\s*['"]pending['"]\)/);
  });

  it("reads its own row, and only offers buttons while it is still waiting", () => {
    const block = readFileSync("components/admin/agents/ApprovalDecisionBlock.tsx", "utf8");
    expect(block).toContain("approval-queue?id=");
    expect(block).toContain("isPending(row)");
    expect(block).toContain("proposalStatusLabel(row.status)");
  });
});
