// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readRuler, formatRulerLine } from "@/lib/build/ruler";

/**
 * The ruler is the only thing that makes a claim believable in this project. It reads three
 * measured sources — the capability master list, the transfer ledger, the census — and reports
 * what each one answered. A source that did not answer is NAMED, never reported as zero: a
 * reassuring zero is the defect class this whole programme exists to kill.
 */

function workspace(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ruler-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body, "utf8");
  }
  return root;
}

describe("readRuler", () => {
  it("counts the capability items by status, from the item lines themselves", () => {
    const root = workspace({
      "master.md": [
        "# القائمة الجامعة",
        "",
        "## أولاً — كابينة القيادة",
        "١. **شات بملء الشاشة** — *مُثبت بدليل* — مقيس على ٣٩٠ بكسل",
        "٢. **الاستباقية** — *مبني — بلا دليل* — الكود موجود",
        "٣. **مؤشرات الوصول** — *مُثبت بدليل على ٦ شاشات، والباقي مقاسش* — جزئي",
        "٤. **حسم مفاتيح البيئة** — *مش مبني* — مش مبني أصلاً",
        "",
        "- **مش مبني**: مش مبني أصلاً.",
      ].join("\n"),
      "docs/ledger/transfers.json": JSON.stringify({
        counts: { "not-moved": 489, moving: 6, moved: 29, erased: 1, "no-surface": 7 },
        rows: [
          { atom: "a", state: "moved", proof: "مقيس" },
          { atom: "b", state: "moved" },
          { atom: "c", state: "not-moved" },
        ],
      }),
      "docs/ledger/census.json": JSON.stringify({
        counts: {
          atoms: 532,
          allDoors: 207,
          adminDoors: 122,
          orphanDoors: 77,
          oldPages: 17,
          oldPageLines: 5050,
          newPages: 15,
          newPageLines: 908,
          crons: 2,
        },
      }),
    });

    const ruler = readRuler({
      masterListPath: join(root, "master.md"),
      ledgerDir: join(root, "docs/ledger"),
      cronDoorRoot: root,
    });

    expect(ruler.items).toEqual({
      total: 4,
      proven: 1,
      partial: 1,
      builtNoProof: 1,
      notBuilt: 1,
      unknown: 0,
    });
    expect(ruler.atoms?.total).toBe(532);
    expect(ruler.atoms?.moved).toBe(29);
    expect(ruler.atoms?.withProof).toBe(1);
    expect(ruler.doors).toEqual({ all: 207, admin: 122, orphan: 77 });
    expect(ruler.pages).toEqual({ old: 17, oldLines: 5050, new: 15, newLines: 908 });
    expect(ruler.missing).toEqual([]);
  });

  it("names a source that did not answer instead of reporting zero", () => {
    const root = workspace({
      "docs/ledger/census.json": JSON.stringify({ counts: { atoms: 10, allDoors: 3 } }),
    });

    const ruler = readRuler({
      masterListPath: join(root, "does-not-exist.md"),
      ledgerDir: join(root, "docs/ledger"),
      cronDoorRoot: root,
    });

    expect(ruler.items).toBeNull();
    expect(ruler.missing).toContain("masterList");
    expect(ruler.atoms).toBeNull();
    expect(ruler.missing).toContain("transfers");
    expect(JSON.stringify(ruler)).not.toMatch(/"total":0/);
  });

  it("counts cron doors on disk and scheduled ones in the census, apart", () => {
    const root = workspace({
      "app/api/cron/ops-daily/route.ts": "export {}",
      "app/api/cron/admin-daily-report/route.ts": "export {}",
      "app/api/cron/monthly-refresh/route.ts": "export {}",
      "docs/ledger/transfers.json": JSON.stringify({ counts: {}, rows: [] }),
      "docs/ledger/census.json": JSON.stringify({ counts: { crons: 2, atoms: 0 } }),
    });

    const ruler = readRuler({
      masterListPath: join(root, "missing.md"),
      ledgerDir: join(root, "docs/ledger"),
      cronDoorRoot: root,
    });

    expect(ruler.crons).toEqual({ doors: 3, scheduled: 2 });
  });

  it("refuses a census whose counts contradict the ledger's atom total", () => {
    const root = workspace({
      "docs/ledger/transfers.json": JSON.stringify({
        counts: { "not-moved": 5, moved: 5 },
        rows: [],
      }),
      "docs/ledger/census.json": JSON.stringify({ counts: { atoms: 11 } }),
    });

    const ruler = readRuler({
      masterListPath: join(root, "missing.md"),
      ledgerDir: join(root, "docs/ledger"),
      cronDoorRoot: root,
    });

    expect(ruler.atoms?.total).toBe(10);
    expect(ruler.missing).toContain("censusAtoms");
  });

  it("prints the owner's ruler line in his digits", () => {
    const root = workspace({
      "master.md": [
        "١. **بند** — *مُثبت بدليل* — مقيس",
        "٢. **بند** — *مبني — بلا دليل* — الكود موجود",
        "٣. **بند** — *مش مبني* — لأ",
      ].join("\n"),
      "docs/ledger/transfers.json": JSON.stringify({
        counts: { "not-moved": 489, moved: 29, moving: 6, erased: 1, "no-surface": 7 },
        rows: [{ atom: "a", state: "moved", proof: "مقيس" }],
      }),
      "docs/ledger/census.json": JSON.stringify({
        counts: {
          atoms: 532,
          allDoors: 207,
          adminDoors: 122,
          orphanDoors: 77,
          oldPages: 17,
          oldPageLines: 5050,
          newPages: 15,
          newPageLines: 908,
          crons: 2,
        },
      }),
    });

    const line = formatRulerLine(
      readRuler({
        masterListPath: join(root, "master.md"),
        ledgerDir: join(root, "docs/ledger"),
        cronDoorRoot: root,
      }),
      { phase: 0, tests: 2486 },
    );

    expect(line).toContain("من ١٢");
    expect(line).toContain("المرحلة ٠");
    expect(line).toContain("١ من ٣");
    expect(line).toContain("٢٩ من ٥٣٢");
    expect(line).toContain("٢٤٨٦");
    expect(line).not.toMatch(/[0-9]/);
    expect(line).not.toMatch(/[A-Za-z]/);
  });

  it("says what is not measured in the line itself, in his language", () => {
    const root = workspace({});
    const line = formatRulerLine(
      readRuler({
        masterListPath: join(root, "missing.md"),
        ledgerDir: join(root, "docs/ledger"),
        cronDoorRoot: root,
      }),
      { phase: 0, tests: null },
    );

    expect(line).toContain("ما اتقارش");
    expect(line).toContain("القائمة الجامعة");
    expect(line).not.toMatch(/البند ٠ من/);
    expect(line).not.toMatch(/الذرة ٠ من/);
    expect(line).not.toMatch(/الاختبارات ٠/);
    expect(line).not.toMatch(/[A-Za-z]/);
  });

  it("carries the date the ledger was measured, so a stale number cannot pass as today's", () => {
    const root = workspace({
      "docs/ledger/transfers.json": JSON.stringify({
        generatedAt: "2026-10-23T16:30:40.657Z",
        counts: { "not-moved": 489, moved: 29, moving: 6, erased: 1, "no-surface": 7 },
        rows: [],
      }),
      "docs/ledger/census.json": JSON.stringify({ generatedAt: "2026-10-23T16:30:40.652Z", counts: { atoms: 532 } }),
    });

    const line = formatRulerLine(
      readRuler({ masterListPath: join(root, "missing.md"), ledgerDir: join(root, "docs/ledger"), cronDoorRoot: root }),
      { phase: 1, tests: 2486, today: "2026-11-05" },
    );

    expect(line).toContain("الجرد من ٢٠٢٦-١٠-٢٣");
    expect(line).not.toMatch(/2026/);
  });

  it("stays quiet about the date when the ledger was measured today", () => {
    const root = workspace({
      "docs/ledger/transfers.json": JSON.stringify({
        generatedAt: "2026-11-05T08:00:00.000Z",
        counts: { "not-moved": 0, moved: 1, moving: 0, erased: 0, "no-surface": 0 },
        rows: [],
      }),
      "docs/ledger/census.json": JSON.stringify({ generatedAt: "2026-11-05T08:00:00.000Z", counts: { atoms: 1 } }),
    });

    const line = formatRulerLine(
      readRuler({ masterListPath: join(root, "missing.md"), ledgerDir: join(root, "docs/ledger"), cronDoorRoot: root }),
      { phase: 1, tests: 2486, today: "2026-11-05" },
    );

    expect(line).not.toContain("الجرد من");
  });
});
