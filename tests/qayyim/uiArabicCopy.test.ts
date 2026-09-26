// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The same line-shape rule the swarm's prose obeys, applied to the screen the
 * owner actually opens: a Latin token inside an Arabic sentence flips the bidi
 * rendering, so the line arrives scrambled — the words are correct and
 * unreadable at the same time.
 *
 * Foreign names are still allowed where they belong: a line of their own. That
 * is why the check is per line and not per file.
 */
const SURFACES = [
  "components/admin/agents/ChatPanel.tsx",
  "components/admin/agents/CommandPalette.tsx",
  "components/admin/agents/SelfModelPanel.tsx",
  "components/admin/agents/ProposalDecisionCard.tsx",
  "components/admin/qayyim/QayyimStudio.tsx",
  "lib/qayyim/palette.ts",
  "lib/qayyim/proposal-card.ts",
];

/**
 * Arabic copy written by a human: quoted text and JSX text, line by line.
 *
 * Line-wise on purpose. A multi-line regex over the whole file invents strings
 * out of the code between two quotes, and a guard that cries wolf gets ignored —
 * which is how the Latin acronyms below slipped through in the first place.
 * Interpolated values are dropped: what the runtime substitutes is the palette
 * and self-view suites' business, not this one's.
 */
function arabicCopy(src: string): string[] {
  const out: string[] = [];
  for (const rawLine of src.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) continue;
    const quoted = /(['"`])([^'"`]*)\1/g;
    let m: RegExpExecArray | null;
    while ((m = quoted.exec(line))) {
      const text = m[2].replace(/\$\{[^}]*\}/g, "");
      if (/\p{Script=Arabic}/u.test(text)) out.push(text);
    }
    const jsx = />([^<>{}]*)</g;
    while ((m = jsx.exec(line))) {
      const text = m[1].trim();
      if (text && /\p{Script=Arabic}/u.test(text)) out.push(text);
    }
  }
  return out;
}

/** Arabic script plus two or more Latin letters in one run of text. */
function mixed(s: string): boolean {
  return /\p{Script=Arabic}/u.test(s) && /[A-Za-z]{2,}/.test(s);
}

describe("the owner's screens are Arabic per line", () => {
  it.each(SURFACES)("%s carries no Latin inside an Arabic sentence", (file) => {
    const src = readFileSync(resolve(process.cwd(), file), "utf8");
    const offenders = arabicCopy(src).filter(mixed);
    expect(offenders, `${file} — put the foreign name on a line of its own`).toEqual([]);
  });
});
