// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { DEAD_KEYS, LIVE_FACTS, SECRET_MASK, factLabel } from "@/lib/settings/facts";

/**
 * The settings office, guarded.
 *
 * Measured 2026-10-13 against the live database (`node scratch/census-site-settings.mjs`) and a
 * reader grep over the whole repository: `site_settings` holds 17 keys; three are read by something
 * that renders (`theme`, `seo`, `telegram_config`), and fourteen are read by nothing but the old
 * desk's own generic editor. The same census found the alert bot's credential sitting in that table —
 * and the settings door was handing it to the browser inside the row, where the old desk printed it
 * in a textarea.
 */
const read = (f: string) => readFileSync(f, "utf8");

describe("the registry is the measured census, not a memory", () => {
  it("names all seventeen keys the table holds, once each", () => {
    const keys = [...LIVE_FACTS.map((f) => f.key), ...DEAD_KEYS.map((d) => d.key)];
    expect(keys.length).toBe(17);
    expect(new Set(keys).size).toBe(17);
  });

  it("seats exactly three keys behind a surface that reads them", () => {
    expect(LIVE_FACTS.map((f) => f.key)).toEqual(["seo", "theme", "telegram_config"]);
  });

  it("gives every key an Arabic name, and none of them is the machine key", () => {
    for (const key of [...LIVE_FACTS.map((f) => f.key), ...DEAD_KEYS.map((d) => d.key)]) {
      const label = factLabel(key);
      expect(label, key).toBeTruthy();
      expect(label).not.toBe(key);
      expect(label).toMatch(/[\u0600-\u06FF]/);
    }
  });
});

describe("the credential never reaches a screen", () => {
  const door = read("app/api/admin/settings/route.ts");
  const desk = read("components/admin/settings/SettingsFactsDesk.tsx");

  it("the door masks the secret keys on both read paths", () => {
    expect(door).toContain('SECRET_KEYS = new Set(["telegram_config"])');
    expect(door).toContain("maskSecret(data as SiteSetting)");
    expect(door).toContain("rawMasked");
  });

  it("the door refuses to save the mask back over a real key", () => {
    expect(door).toContain("carriesMask(value)");
    expect(door).toContain("مفيش مفتاح بيتكتب على الشاشة");
  });

  it("the desk counts what is around the credential and never reads the credential", () => {
    expect(desk).not.toMatch(/botToken|\.token\b|password/);
    expect(desk).toContain("SECRET_MASK");
    expect(SECRET_MASK).toMatch(/[\u0600-\u06FF]/);
  });
});

describe("the desk shows controls only for what answers", () => {
  const desk = read("components/admin/settings/SettingsFactsDesk.tsx");
  const page = read("app/admin/v2/settings/page.tsx");

  it("starts below the floating menu button, so the first line is not eaten", () => {
    // Measured on the published site at 390px: the cockpit's gold menu button sits over the page's
    // first line, and «الإعدادات — البيت الجديد» was cut to «ت — البيت الجديد».
    expect(page).toContain("pt-20");
  });

  it("names the residue and counts it, instead of offering fourteen dead switches", () => {
    expect(desk).toContain("وما بيقرأهاش أي سطح");
    expect(desk).toContain("residue.map");
    expect(desk).toContain("مسحها كلمة");
  });

  it("carries no erase button — deleting a stored value is the owner's word", () => {
    expect(desk).not.toContain("DELETE");
    expect(desk).not.toMatch(/method:\s*"DELETE"/);
  });
});
