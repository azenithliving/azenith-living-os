// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A conversation that could not be read must say so — on the screen, not in the console.
 *
 * Measured 2026-10-15 with scratch/reproduce-the-silent-chat-read.mjs on the published site, signed in,
 * at 390px, three reloads of the sales office:
 *   · the door answering → the bubbles are there, zero console errors;
 *   · the door cut mid-air → the screen shows «ابدأ محادثة تشغيلية» as if the shop had nothing to tell
 *     him, while the same conversation holds rows — and 26 console errors carrying the only truth;
 *   · the door answering with its own honest 500 («خطأ في السيرفر») → the same lie on screen.
 * The read path had no failure state at all: `if (data.success && …)` with no else, and a `catch` that
 * only wrote to the console, while `loading` cleared in `finally` — so the render fell through to the
 * empty panel. The store's own convention already exists elsewhere («الدفتر ما ردّش — مش معناه إن
 * مفيش عملاء», see components/admin/ClientPreCallDossier.tsx); this pins it on the chat too.
 */
const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
const door = readFileSync("app/api/admin/agents/messages/route.ts", "utf8");

describe("the owner's chat read speaks when the record does not answer", () => {
  it("keeps a read state of its own, so a refusal is never drawn as an empty conversation", () => {
    expect(panel).toContain("readState");
    expect(panel).toMatch(/setReadState\(["']refused["']\)/);
    expect(panel).toMatch(/setReadState\(["']answered["']\)/);
  });

  it("names the handle the live measurement reads", () => {
    expect(panel).toContain("data-chat-read-state={readState}");
  });

  it("shows the empty panel only for a conversation the record really answered empty", () => {
    const gate = panel.match(/readState === ["']answered["']\s*&&\s*messages\.length === 0/);
    expect(gate, "the empty panel must not be reachable from a refused read").not.toBeNull();
  });

  it("says the honest sentence in his Arabic, with the way to try again", () => {
    expect(panel).toContain("المحادثة ما جاتش");
    expect(panel).toContain("مش معناه إن مفيش كلام");
    expect(panel).toContain("حاول تاني");
  });

  it("keeps the bubbles already on screen when a later poll fails", () => {
    const refused = panel.match(/setReadState\(["']refused["']\)[\s\S]{0,260}?setReadProblem\(/);
    expect(refused, "a failed poll must not clear the messages it could not refresh").not.toBeNull();
    expect(panel).not.toMatch(/setMessages\(\[\]\)[\s\S]{0,120}setReadState\(["']refused["']\)/);
  });

  it("never prints a machine word to the owner", () => {
    const block = panel.match(/data-chat-read-state="refused"[\s\S]{0,1400}?<\/div>\s*\)\}/);
    expect(block, "the refusal block exists and closes on its own").not.toBeNull();
    // Only the words between the tags are his; attributes and expressions are the machine's business.
    const textNodes = [...block![0].matchAll(/>([^<>]+)</g)]
      .map((m) => m[1].trim())
      .filter((t) => t.length > 0 && !t.startsWith("{"));
    expect(textNodes.length, "the refusal block carries copy").toBeGreaterThan(0);
    const latin = textNodes.flatMap((t) => t.match(/\b[A-Za-z]{2,}\b/g) ?? []);
    expect(latin, textNodes.join(" | ")).toEqual([]);
  });
});

describe("the messages door does not report an unreadable read as an empty one", () => {
  it("reads the conversation lookup's error instead of dropping it", () => {
    expect(door).toMatch(/error:\s*convError/);
    expect(door).toMatch(/if \(convError\)/);
  });

  it("refuses with its own sentence rather than answering success with nothing", () => {
    // Bounded to the branch's own body: the next lines hold the honest empty answer for a
    // conversation that genuinely does not exist yet, and that one is allowed.
    const branch = door.match(/if \(convError\)\s*\{[\s\S]*?\n {6}\}/);
    expect(branch).not.toBeNull();
    expect(branch![0]).toContain("success: false");
    expect(branch![0]).not.toContain("data: []");
  });

  it("does not hand an English schema note to an Arabic screen", () => {
    expect(door).not.toContain("schema is not available in the expected shape");
  });
});

describe("the composer fits the phone it is written for", () => {
  // Measured live 2026-10-15 at 390px on the leader's own desk: the row held 581px of buttons and an
  // input that could not shrink (`min-width: auto`, the flex default), so the whole typing box — and
  // the send button with it — spilled past the left edge of the screen. The owner could read the
  // swarm's chat and could not answer it.
  it("lets the tool buttons fall to a second line instead of pushing the input out", () => {
    expect(panel).toMatch(/className=\{`flex flex-wrap gap-2/);
  });

  it("lets the input shrink, which is what `flex-1` was always meant to do", () => {
    const composer = panel.match(/data-chat-composer[\s\S]{0,1400}?className="([^"]+)"/);
    expect(composer, "the composer's own classes").not.toBeNull();
    expect(composer![1]).toContain("min-w-0");
    expect(composer![1]).toContain("flex-1");
  });
});
