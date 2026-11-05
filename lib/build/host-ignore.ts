/**
 * host-ignore.ts — does the host build even receive this file?
 *
 * `.vercelignore` decides what the server gets, and a bare name in it matches that segment at any
 * depth: `build` silently stripped `lib/build`, so the publish failed on a tree whose local build
 * was green. This is the small subset of gitignore matching that the hazard needs — anchored versus
 * bare patterns, single-segment wildcards, and negation.
 */

export function sourceLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function toRegex(pattern: string): { re: RegExp; anchored: boolean } {
  const anchored = pattern.includes("/");
  const clean = pattern.replace(/^\/+/, "").replace(/\/+$/, "");
  let source = "";
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "*") {
      if (clean[i + 1] === "*") {
        source += ".*";
        i++;
        if (clean[i + 1] === "/") i++;
      } else {
        source += "[^/]*";
      }
    } else if ("\\^$.|?+()[]{}".includes(ch)) {
      source += "\\" + ch;
    } else {
      source += ch;
    }
  }
  return { re: new RegExp(`^${source}$`), anchored };
}

export function isExcludedFromHostBuild(rules: string[], path: string): boolean {
  const segments = path.split("/");
  let excluded = false;
  for (let depth = 1; depth <= segments.length; depth++) {
    const prefix = segments.slice(0, depth).join("/");
    const basename = segments[depth - 1];
    for (const rule of rules) {
      const negated = rule.startsWith("!");
      const { re, anchored } = toRegex(negated ? rule.slice(1) : rule);
      const hit = anchored ? re.test(prefix) : re.test(basename);
      if (hit) excluded = !negated;
    }
  }
  return excluded;
}
