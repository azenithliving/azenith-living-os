import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/**
 * The shared primitives used to carry a light room inside a dark house.
 *
 * Measured on the owner's library panel: its cards painted `bg-white` with `text-slate-900` inside
 * the dark admin shell, and the outline button next to «سجلات GitHub Actions» painted white on
 * white — a control nobody can see is a control that does not exist. The fix is a token pass, not
 * a class patch on that one panel: the primitives ask the house what colour it is.
 */
const globals = readFileSync("app/globals.css", "utf8");
const card = readFileSync("components/ui/card.tsx", "utf8");
const button = readFileSync("components/ui/button.tsx", "utf8");
const badge = readFileSync("components/ui/badge.tsx", "utf8");
const shell = readFileSync("app/admin/layout-client.tsx", "utf8");
const preview = readFileSync("app/preview/section/[id]/page.tsx", "utf8");

describe("the library panel speaks the owner's language", () => {
  const panel = readFileSync("app/admin/intel/components/ImageHarvestDashboard.tsx", "utf8");

  it("keeps Latin words out of the sentences it renders, except what he must type", () => {
    // Only what a person reads: JSX text nodes and the string literals inside them. A JS
    // statement is not copy, and a guard that scans code lines reports its own language as a bug.
    const rendered = [...panel.matchAll(/>([^<>]*\p{Script=Arabic}[^<>]*)</gu)]
      // Everything inside braces is code the renderer evaluates — including a nested template
      // literal — and is not a word the owner reads.
      .map((m) => m[1].replace(/\{.*\}/g, "").trim());
    expect(rendered.length, "the guard must have sentences to read").toBeGreaterThan(8);
    const offenders = rendered.filter((line) => /[A-Za-z]{4,}/.test(line));
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("stops relying on a dark variant the house never sets", () => {
    // `dark:text-red-200` on a panel whose text default was dark ink: the error message was
    // unreadable exactly when the owner needed it.
    expect(panel).not.toMatch(/\bdark:/);
  });
});

describe("the library panel's chips never print a raw key", () => {
  // Measured on the live bank 2026-10-05: these are every room type and style the active pictures
  // actually hold. A new value that arrives here without an Arabic name would print its machine key
  // on the owner's screen — which is how `lounge` reached him in 2026-10-03.
  const BANK_ROOMS = ["master-bedroom", "comprehensive-interior", "living-room", "children-room", "dining-room", "lounge", "corner-sofa", "teen-room"];
  const BANK_STYLES = ["modern", "scandinavian", "classic", "industrial"];

  it("names every room type the bank holds", async () => {
    const { ROOM_TYPE_LABELS } = await import("@/lib/cad/room-labels");
    for (const room of BANK_ROOMS) {
      expect(ROOM_TYPE_LABELS[room], room).toMatch(/\p{Script=Arabic}/u);
    }
  });

  it("names every style the bank holds", async () => {
    const { STYLE_LABELS } = await import("@/lib/constants/rooms");
    for (const style of BANK_STYLES) {
      expect(STYLE_LABELS[style], style).toMatch(/\p{Script=Arabic}/u);
    }
  });
});

describe("the house answers, the primitives obey", () => {
  it("defines the panel tokens once, with the light room as the default", () => {
    for (const token of ["--color-panel:", "--color-panel-fg:", "--color-panel-border:", "--color-panel-muted:"]) {
      expect(globals, token).toContain(token);
    }
    // The public preview page is a light room: the default must stay light, not flip with the admin.
    expect(globals.slice(globals.indexOf("@theme"), globals.indexOf(".admin-house"))).toMatch(/--color-panel:\s*#fff|--color-panel:\s*#ffffff|--color-panel:\s*white/);
  });

  it("gives the admin house dark values under its own class", () => {
    const house = globals.slice(globals.indexOf(".admin-house"));
    expect(house).toContain("--color-panel-fg:");
    const panel = /--color-panel:\s*#([0-9a-f]{6})/i.exec(house)?.[1];
    expect(panel, "the house must answer with its own panel colour").toBeTruthy();
    // Dark means dark: the red channel of the house panel has to sit well below white.
    expect(parseInt(String(panel).slice(0, 2), 16)).toBeLessThan(0x40);
    const fg = /--color-panel-fg:\s*#([0-9a-f]{6})/i.exec(house)?.[1];
    expect(parseInt(String(fg).slice(0, 2), 16)).toBeGreaterThan(0xb0);
  });

  it("carries the house class on the shell that wraps every admin screen", () => {
    expect(shell).toContain("admin-house");
  });

  it("stops hardcoding a light room inside the primitives", () => {
    for (const source of [card, button, badge]) {
      expect(source).not.toMatch(/bg-white\b/);
      expect(source).not.toMatch(/text-slate-900\b/);
      expect(source).not.toMatch(/bg-slate-100\b/);
      expect(source).not.toMatch(/border-slate-200\b/);
    }
    expect(card).toContain("bg-panel");
    expect(button).toContain("bg-panel");
    expect(badge).toContain("text-panel-fg");
  });

  it("leaves the light house alone where it never used the tokens", () => {
    expect(preview).toContain("text-gray-600");
    expect(preview).not.toContain("admin-house");
  });
});
