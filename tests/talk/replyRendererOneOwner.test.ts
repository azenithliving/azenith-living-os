import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * One owner for «how an answer is drawn».
 *
 * Measured on the owner's assistant dock 2026-10-24 (and again the next evening on the same screen):
 * the emphasis fix of task #19 lives in a renderer that was written *inside* the employees' chat
 * panel and never exported, so every other surface that prints an answer was still showing
 * «**حفظت تفضيلك:**» with the asterisks on the glass. The rule existed; it just had no door.
 */

const SHARED = "components/talk/MarkdownContent.tsx";

function codeOf(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function allComponents(): string[] {
  const found: string[] = [];
  const walk = (p: string) => {
    if (!existsSync(p)) return;
    for (const entry of readdirSync(p)) {
      const full = join(p, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(full)) found.push(full.replace(/\\/g, "/"));
    }
  };
  walk("components");
  return found;
}

describe("the reply renderer has one home", () => {
  it("exactly one module defines it, and it is the shared one", () => {
    const homes = allComponents().filter((file) => /function MarkdownContent\(/.test(codeOf(file)));
    expect(homes).toEqual([SHARED]);
  });

  it("the employees' chat panel asks the shared renderer instead of owning it", () => {
    const panel = codeOf("components/admin/agents/ChatPanel.tsx");
    expect(panel).toContain(`from '@/components/talk/MarkdownContent'`);
    expect(panel).not.toMatch(/function MarkdownContent\(/);
    expect(panel).toMatch(/<MarkdownContent content=\{isUser \? message\.content : ownerRowText/);
  });

  it("every assistant surface that answers him draws through it", () => {
    const surfaces = [
      "components/admin/GlobalAssistantDock.tsx",
      "components/admin/UnifiedAssistant.tsx",
      "components/admin/AssistantBrowserCopilot.tsx",
    ];
    for (const file of surfaces) {
      const code = codeOf(file);
      expect(code, file).toContain("MarkdownContent");
      expect(code, file).not.toMatch(/whitespace-pre-wrap[^>]*>\{(msg|message|latestAssistant)\.content\}/);
    }
  });

  it("the dock's collapsed preview still clamps, so a long answer cannot fill his screen", () => {
    const dock = codeOf("components/admin/GlobalAssistantDock.tsx");
    expect(dock).toMatch(/className="line-clamp-2"[\s\S]{0,80}<MarkdownContent/);
  });

  it("the shared renderer keeps the order the defect was found in: markers before bare addresses", () => {
    const shared = codeOf(SHARED);
    const inline = shared.slice(shared.indexOf("const renderInline"));
    expect(inline.indexOf("splitInline(text)")).toBeLessThan(inline.indexOf("split(INLINE_LINK)"));
    expect(shared).toContain('data-emphasis="bold"');
    expect(shared).toContain("isBulletLine(line)");
    expect(shared).toContain("bracketListItems(line)");
  });
});
