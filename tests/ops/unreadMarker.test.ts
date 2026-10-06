// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { locateFirstUnread, readStamp, unreadJump } from "@/lib/ops/unread-marker";

/**
 * Where the conversation reopens when he comes back to it.
 *
 * Measured live on the published cockpit 2026-10-06 (scratch/check-unread-jump.mjs): with a real
 * thread of 50 stored rows the panel did land on the unread line 8px under the toolbar, and with
 * nothing unread it stayed at the bottom. What the walk cannot see is the two ways that result is
 * borrowed from luck: the finder trusts the door's array order, so a newest-first page would put
 * the line above the NEWEST unread and hide everything between it and the last thing he read; and
 * the one-shot flag is burned before the marker node is checked, so a jump owed while the list is
 * still loading is never paid.
 */
const agent = (id: string, at: number) => ({ id, sender_type: "agent", created_at: new Date(at).toISOString() });
const owner = (id: string, at: number) => ({ id, sender_type: "user", created_at: new Date(at).toISOString() });

describe("the unread line is placed by time, not by luck", () => {
  it("takes the earliest agent answer after his stamp when the door hands rows newest-first", () => {
    const rows = [agent("newest", 3000), agent("middle", 2000), agent("oldest-unread", 1500), agent("read", 1000)];
    expect(locateFirstUnread(rows, 1200)).toBe("oldest-unread");
  });

  it("takes the same one when the door hands them in order", () => {
    const rows = [agent("read", 1000), agent("oldest-unread", 1500), agent("middle", 2000), agent("newest", 3000)];
    expect(locateFirstUnread(rows, 1200)).toBe("oldest-unread");
  });

  it("does not open a line for his own words", () => {
    expect(locateFirstUnread([owner("mine", 5000)], 1000)).toBeNull();
  });

  it("says nothing is unread when he never read this thread on this device", () => {
    expect(locateFirstUnread([agent("a", 5000)], 0)).toBeNull();
  });

  it("says nothing is unread when his stamp is the last word", () => {
    expect(locateFirstUnread([agent("a", 5000)], 5000)).toBeNull();
    expect(locateFirstUnread([agent("a", 5000)], 5001)).toBeNull();
  });

  it("walks past a row whose time never arrived", () => {
    const rows = [{ id: "broken", sender_type: "agent", created_at: null }, agent("real", 4000)];
    expect(locateFirstUnread(rows, 1000)).toBe("real");
  });

  it("reads a missing or garbage stamp as never read", () => {
    expect(readStamp(null)).toBe(0);
    expect(readStamp("")).toBe(0);
    expect(readStamp("not-a-number")).toBe(0);
    expect(readStamp("-5")).toBe(0);
    expect(readStamp("1762000000000")).toBe(1762000000000);
  });
});

describe("a jump he is owed stays owed", () => {
  it("jumps once the marker is actually on screen", () => {
    expect(unreadJump({ firstUnread: "x", markerMounted: true, alreadyJumped: false })).toBe("jump");
  });

  it("waits instead of spending the jump when the list has not rendered the marker yet", () => {
    expect(unreadJump({ firstUnread: "x", markerMounted: false, alreadyJumped: false })).toBe("wait");
  });

  it("never claims a jump for a thread with nothing unread", () => {
    expect(unreadJump({ firstUnread: null, markerMounted: true, alreadyJumped: false })).toBe("none");
  });

  it("only pays a jump once", () => {
    expect(unreadJump({ firstUnread: "x", markerMounted: true, alreadyJumped: true })).toBe("settled");
  });
});

describe("the cockpit is wired to the written rule", () => {
  const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");

  it("asks the module where the unread line goes", () => {
    expect(panel).toContain("locateFirstUnread(");
    expect(panel).toContain("readStamp(");
  });

  it("asks the module before spending the jump", () => {
    expect(panel).toContain("unreadJump({");
  });

  it("keeps the line's own Arabic words", () => {
    expect(panel).toContain("رسائل جديدة");
  });
});
