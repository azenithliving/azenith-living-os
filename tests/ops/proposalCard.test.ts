// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  betterRequestMessage,
  decisionRequest,
  findProposal,
  isExpired,
  parseProposalId,
  proposalStatusLabel,
  riskLabel,
  type ProposalRow,
} from "@/lib/ops/proposal-card";

/**
 * The morning story on Telegram ends with a link to one decision. When the owner
 * taps it he is not asking a question — he is arriving to answer one. So the link
 * has to open the real proposal, and its three buttons have to do the three real
 * things: execute it, ask for a better version, or close it.
 *
 * Everything that decides is here, where a clock and a row list can be handed to
 * it. Reading the row shape from `approval_requests` is the component's job.
 */

const DAY = 86_400_000;

function row(over: Partial<ProposalRow> = {}): ProposalRow {
  return {
    id: "9f1c0b6e-4d3a-4d59-8f4f-2b8d5f1a7c30",
    description: "صفحة الصالة محتاجة صورة أعلى أوضح",
    risk_level: "medium",
    status: "pending",
    created_at: new Date(Date.now() - DAY).toISOString(),
    expires_at: new Date(Date.now() + DAY).toISOString(),
    metadata: { userMessage: "اقترح تحسين صورة الصالة", intent: { kind: "content" } },
    ...over,
  };
}

describe("parseProposalId", () => {
  it("reads the id the Telegram link carries", () => {
    expect(
      parseProposalId("?proposal=9f1c0b6e-4d3a-4d59-8f4f-2b8d5f1a7c30&x=1"),
    ).toBe("9f1c0b6e-4d3a-4d59-8f4f-2b8d5f1a7c30");
  });

  it("ignores everything that is not an id shape", () => {
    expect(parseProposalId("")).toBeNull();
    expect(parseProposalId("?proposal=")).toBeNull();
    expect(parseProposalId("?proposal=%20%20")).toBeNull();
    expect(parseProposalId("?proposal=<script>alert(1)</script>")).toBeNull();
    expect(parseProposalId("?proposal=../../etc/passwd")).toBeNull();
    expect(parseProposalId("?proposal=" + "a".repeat(200))).toBeNull();
  });

  it("accepts a short internal id too, and a url-encoded one", () => {
    expect(parseProposalId("?proposal=abc123")).toBe("abc123");
    expect(parseProposalId("?proposal=abc-123_X")).toBe("abc-123_X");
  });
});

describe("findProposal", () => {
  it("picks the row the link points at", () => {
    const target = row();
    const rows = [row({ id: "other-id-1" }), target];
    expect(findProposal(rows, target.id)).toBe(target);
  });

  it("says null when the id is not among the pending rows", () => {
    expect(findProposal([row({ id: "other-id-1" })], "missing-id")).toBeNull();
    expect(findProposal([], "missing-id")).toBeNull();
    expect(findProposal(null, "missing-id")).toBeNull();
  });
});

describe("decisionRequest", () => {
  it("builds the body the decision route already accepts", () => {
    expect(decisionRequest("id-1", "approved")).toEqual({ approval_id: "id-1", decision: "approved" });
    expect(decisionRequest("id-1", "rejected")).toEqual({ approval_id: "id-1", decision: "rejected" });
  });
});

describe("betterRequestMessage", () => {
  /** «عايز أحسن» is not a rejection: the owner wants the swarm to try again, so
   * the message has to carry what the proposal was about. */
  it("asks for a better version and names the subject", () => {
    const msg = betterRequestMessage(row());
    expect(msg).toContain("أحسن");
    expect(msg).toContain("صفحة الصالة محتاجة صورة أعلى أوضح");
    expect(/\p{Script=Arabic}/u.test(msg)).toBe(true);
    expect(/[A-Za-z]{2,}/.test(msg)).toBe(false);
  });

  it("survives a row with no description", () => {
    expect(betterRequestMessage(row({ description: "" }))).toContain("الاقتراح");
  });
});

describe("isExpired", () => {
  const now = Date.UTC(2026, 8, 26, 12);

  it("closes a decision whose window has passed", () => {
    expect(isExpired(row({ expires_at: new Date(now - 1000).toISOString() }), now)).toBe(true);
    expect(isExpired(row({ expires_at: new Date(now + DAY).toISOString() }), now)).toBe(false);
  });

  /** A row with no expiry is not "expired" — the proposal route sets 48 hours,
   * and legacy rows have none. Failing them closed would hide real decisions. */
  it("treats a missing expiry as still open", () => {
    expect(isExpired(row({ expires_at: null }), now)).toBe(false);
  });
});

describe("proposalStatusLabel", () => {
  it("names the states the owner can land on", () => {
    expect(proposalStatusLabel("pending")).toContain("في انتظارك");
    expect(proposalStatusLabel("executed")).toBeTruthy();
    expect(proposalStatusLabel("whatever")).toBeTruthy();
  });
});

/** `risk_level` is stored as a Latin word. Printed as-is it scrambles the Arabic
 * line it sits in, so it gets an Arabic word of its own — including when the row
 * carries something the ladder does not know. */
describe("riskLabel", () => {
  it.each([
    ["low", "منخفضة"],
    ["medium", "متوسطة"],
    ["high", "عالية"],
    ["critical", "حرجة"],
    ["MEDIUM", "متوسطة"],
  ])("translates %s", (input, expected) => {
    expect(riskLabel(input)).toBe(expected);
  });

  it("never leaks the raw stored value into an Arabic sentence", () => {
    for (const raw of ["", null, undefined, "extreme", "???"]) {
      const label = riskLabel(raw as string | null | undefined);
      expect(/[A-Za-z]/.test(label)).toBe(false);
      expect(label).toBe("غير مصنّفة");
    }
  });
});
