#!/usr/bin/env node
/**
 * scratch-manifest.mjs — write the record of what the throwaway folder held.
 * Refuses to write a manifest for a folder that did not answer.
 */
import { writeFileSync } from "node:fs";

import { readScratchManifest } from "../lib/build/scratch-manifest.ts";

const root = process.argv[2] ?? "scratch";
const manifest = readScratchManifest(root);

if (!manifest.found) {
  console.error(`scratch manifest NOT WRITTEN — ${manifest.reason}`);
  process.exitCode = 1;
} else {
  const body = JSON.stringify({ generatedAt: new Date().toISOString(), root, ...manifest }, null, 2) + "\n";
  writeFileSync("docs/ledger/scratch-manifest.json", body, "utf8");
  console.log(
    `scratch manifest: ${manifest.count} files · ${manifest.instruments} instruments · ${manifest.totalBytes} bytes → docs/ledger/scratch-manifest.json`,
  );
}
