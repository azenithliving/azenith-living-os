// @vitest-environment node
/**
 * The command palette is a *command* surface: what it lists must be runnable,
 * and what it shows the owner must be readable. Two invariants carry the whole
 * feature, so both are nailed down here before any component exists:
 *  • every entry is either a whitelisted tool, a page that really renders, or a
 *    view this screen can actually open — the suite refuses invented commands;
 *  • every line of Arabic stays Arabic. A tool id in the middle of a sentence
 *    arrives scrambled on the owner's phone.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TOOL_CATALOG } from "@/lib/agents/intent-router";
import { inferUltimateTool } from "@/lib/admin-tool-bridge";
import { isRealPath } from "@/lib/qayyim/url-manifest";
import {
  CAPABILITY_LABELS,
  buildPalette,
  filterPalette,
  normalizeArabic,
  isPaletteHotkey,
  paletteSectionTitle,
  type SelfModelView,
} from "@/lib/qayyim/palette";

const model: SelfModelView = {
  title: "مدير تشغيل المحتوى",
  brand: "قيّم الدار",
  agents: [
    { key: "qayyim-core", name: "القائد", roles: 6 },
    { key: "qayyim-qa", name: "الجودة", roles: 5 },
  ],
  tools: TOOL_CATALOG.map((t) => ({ name: t.name })),
  limits: ["كرون يومي واحد"],
  organs: [{ label: "كاناري الصفحات العامة", cadence: "كل يوم" }],
  counters: [{ label: "مسودات معلقة", value: 3 }],
};

/** Latin of two letters or more inside a line that also carries Arabic. */
function mixedLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/[•\-]\s*/, "").trim())
    .filter((l) => /\p{Script=Arabic}/u.test(l) && /[A-Za-z]{2,}/.test(l));
}

describe("capability labels", () => {
  it("names every tool in the catalog, and nothing that is not there", () => {
    expect(Object.keys(CAPABILITY_LABELS).sort()).toEqual(TOOL_CATALOG.map((t) => t.name).sort());
  });

  it("is written in the owner's language", () => {
    for (const [name, label] of Object.entries(CAPABILITY_LABELS)) {
      expect(mixedLines(label), name).toEqual([]);
      expect(label.length).toBeGreaterThan(3);
    }
  });
});

describe("buildPalette", () => {
  const items = buildPalette(model);

  it("turns each live tool into a runnable command", () => {
    const run = items.filter((i) => i.kind === "capability");
    expect(run.map((i) => i.runTool).sort()).toEqual(TOOL_CATALOG.map((t) => t.name).sort());
    for (const i of run) {
      // The chat receives Arabic; the tool id travels beside it, not inside it.
      expect(mixedLines(`${i.label}\n${i.send ?? ""}`)).toEqual([]);
      expect(i.href).toBeUndefined();
    }
  });

  it("lists the swarm's own agents so a name is also a command", () => {
    const talk = items.filter((i) => i.kind === "agent");
    expect(talk.map((i) => i.label)).toContain("القائد");
  });

  it("offers the self view and the autonomous schedule", () => {
    expect(items.some((i) => i.id === "view:self" && i.kind === "view")).toBe(true);
    const organs = items.filter((i) => i.kind === "schedule");
    expect(organs.map((i) => i.hint)).toContain("كل يوم");
    // A schedule row informs; it does not pretend to run anything.
    expect(organs.every((i) => !i.runTool && !i.send && !i.href)).toBe(true);
  });

  it("only points at pages that really render", () => {
    const links = items.filter((i) => i.href);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(isRealPath(l.href as string), l.href).toBe(true);
  });

  it("survives a model with nothing in it", () => {
    const empty = buildPalette(null);
    expect(empty.length).toBeGreaterThan(0);
    expect(empty.every((i) => i.kind === "view" || i.kind === "open")).toBe(true);
  });
});

describe("filterPalette", () => {
  const items = buildPalette(model);

  it("matches dialect spelling, hamza and case alike", () => {
    for (const q of ["فخامه", "فخامة", "الفخامة", "luxury"]) {
      const hit = filterPalette(items, q);
      expect(hit.map((i) => i.runTool), q).toContain("qayyim_luxury_score");
    }
  });

  it("requires every word to land, and ranks a prefix above a mid-word hit", () => {
    const ranked = filterPalette(items, "سرعه");
    expect(ranked[0].runTool).toBeTruthy();
    expect(filterPalette(items, "فخامه عميل")).toEqual([]);
    const both = filterPalette(items, "أهداف");
    expect(both.length).toBeGreaterThan(1);
  });

  it("an empty query returns the whole palette, an unknown one returns nothing", () => {
    expect(filterPalette(items, "   ")).toEqual(items);
    expect(filterPalette(items, "زجزهجيه")).toEqual([]);
  });

  it("keeps the section of each entry when grouping", () => {
    expect(paletteSectionTitle("capability")).toContain("أقدر أنفذ");
    expect(paletteSectionTitle("schedule")).toBeTruthy();
  });
});

describe("normalizeArabic", () => {
  it.each([
    ["أنت", "انت"],
    ["إيه", "ايه"],
    ["سرعة", "سرعه"],
    ["مُقاس", "مقاس"],
    ["الرَّسم", "الرسم"],
    ["مستشفى", "مستشفي"],
  ])("folds %s to %s", (input, expected) => {
    expect(normalizeArabic(input)).toBe(expected);
  });

  it("lowers Latin so an English query still finds its tool", () => {
    expect(normalizeArabic("SEO Analyze")).toBe("seo analyze");
  });
});

describe("isPaletteHotkey", () => {
  it("opens on Ctrl+K or Cmd+K only", () => {
    expect(isPaletteHotkey({ key: "k", ctrlKey: true })).toBe(true);
    expect(isPaletteHotkey({ key: "K", metaKey: true })).toBe(true);
    expect(isPaletteHotkey({ key: "k" })).toBe(false);
    expect(isPaletteHotkey({ key: "k", ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isPaletteHotkey({ key: "a", ctrlKey: true })).toBe(false);
  });
});

/**
 * A command must survive being *typed*. The palette clicks with a tool id, but
 * the same words in the chat box are what the owner will do next week from
 * memory — so every label has to route to its own tool through the dialect
 * router too. A label that only works as a button is a slogan, not a command.
 */
describe("every capability label also routes by itself", () => {
  const items = buildPalette(model).filter((i) => i.kind === "capability");

  it("covers the whole catalog", () => {
    expect(items.length).toBe(TOOL_CATALOG.length);
  });

  it.each(items.map((i) => [i.runTool as string, i.send as string]))(
    "%s answers to its own Arabic words",
    (tool, words) => {
      expect(inferUltimateTool(words)?.toolName, words).toBe(tool);
    },
  );
});

/** A palette that drifts from the surface it lives in is a lie by omission. */
describe("the chat surface wires the palette in", () => {  const src = readFileSync(
    resolve(process.cwd(), "components/admin/agents/ChatPanel.tsx"),
    "utf8",
  );

  it("opens with the hotkey and sends through the explicit tool path", () => {
    expect(src).toContain("isPaletteHotkey");
    expect(src).toContain("CommandPalette");
    expect(src).toContain("run_tool");
  });

  it("reads its commands from the live self endpoint, not a typed list", () => {
    expect(src).toContain("/api/admin/qayyim/self");
  });

  /** A row that navigates somewhere is a promise. The chat page has to honour
   * the agent the palette chose, and ignore one that does not exist. */
  it("the chat page honours the agent the palette hands it", () => {
    const page = readFileSync(
      resolve(process.cwd(), "app/admin/v2/agents/qayyim/page.tsx"),
      "utf8",
    );
    expect(page).toContain("agent");
    expect(page).toContain("AGENT_ROLES");
    expect(page).toContain("qayyim-core");
  });
});
