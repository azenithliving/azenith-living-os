/**
 * scratch-manifest.ts — the record that the throwaway proof tooling existed.
 *
 * The instruments that measured this project lived in `scratch/` and were never committed: the
 * evidence machinery was the single most losable part of the repository. This walks the folder and
 * records what was there — names, kinds, sizes — so "nothing was forgotten" has a file behind it.
 * An unreadable folder is reported as unreadable, never as an empty one.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface ScratchManifest {
  found: boolean;
  reason: string;
  count: number | null;
  instruments: number | null;
  byExtension: Record<string, number>;
  names: string[];
  totalBytes: number;
}

const INSTRUMENT_KINDS = new Set(["mjs", "js", "ts", "tsx"]);

function walk(dir: string, prefix: string, hits: { name: string; bytes: number }[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, rel, hits);
    else if (entry.isFile()) hits.push({ name: rel, bytes: statSync(full).size });
  }
}

export function readScratchManifest(root: string): ScratchManifest {
  if (!existsSync(root)) {
    return {
      found: false,
      reason: `the folder did not answer: ${root}`,
      count: null,
      instruments: null,
      byExtension: {},
      names: [],
      totalBytes: 0,
    };
  }

  const hits: { name: string; bytes: number }[] = [];
  walk(root, "", hits);
  hits.sort((a, b) => a.name.localeCompare(b.name));

  const byExtension: Record<string, number> = {};
  for (const file of hits) {
    const ext = file.name.includes(".") ? file.name.split(".").pop()! : "(none)";
    byExtension[ext] = (byExtension[ext] ?? 0) + 1;
  }

  return {
    found: true,
    reason: "",
    count: hits.length,
    instruments: hits.filter((file) => INSTRUMENT_KINDS.has(file.name.split(".").pop() ?? "")).length,
    byExtension,
    names: hits.map((file) => file.name),
    totalBytes: hits.reduce((sum, file) => sum + file.bytes, 0),
  };
}
