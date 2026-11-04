// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { DEAD_KEYS, LIVE_FACTS, SECRET_MASK, factLabel, isSecretSetting } from "@/lib/settings/facts";

/**
 * The settings office, guarded.
 *
 * Measured 2026-11-03 against the live table and a reader grep over the whole repository:
 * `site_settings` holds twenty keys; six are read by code that uses the value, fourteen reach no
 * customer page. The first count (2026-10-13) found seventeen and three live — the store's number
 * desk, the gate's two-factor row and the nightly copy's stamp were written after it, and a registry
 * that stops naming keys starts printing machine keys on his screen. The same first census found the
 * alert bot's credential sitting in that table — and the settings door was handing it to the browser
 * inside the row, where the old desk printed it in a textarea.
 */
const read = (f: string) => readFileSync(f, "utf8");

describe("the registry is the measured census, not a memory", () => {
  it("names every key the table holds, once each", () => {
    const keys = [...LIVE_FACTS.map((f) => f.key), ...DEAD_KEYS.map((d) => d.key)];
    expect(keys.length).toBe(20);
    expect(new Set(keys).size).toBe(20);
  });

  it("seats exactly the six keys a surface reads", () => {
    expect(LIVE_FACTS.map((f) => f.key)).toEqual([
      "seo",
      "theme",
      "telegram_config",
      "contact_numbers",
      "admin_gate_2fa_required",
      "nightly_snapshot_last",
    ]);
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
    // One owner for «which key carries a credential»: the `secret` flag in the facts above.
    // Measured 2026-11-03: the discovery engine reads the same table for the assistants' picture of
    // the store, and it asks this same helper — a second list would drift the day a key is added.
    expect(door).toContain("isSecretSetting(setting.key)");
    expect(door).not.toMatch(/new Set\(\["telegram_config"\]\)/);
    expect(door).toContain("maskSecret(data as SiteSetting)");
    expect(door).toContain("rawMasked");
  });

  it("the census, not a copy, decides which key is a secret", () => {
    expect(isSecretSetting("telegram_config")).toBe(true);
    expect(isSecretSetting("theme")).toBe(false);
    expect(isSecretSetting("seo")).toBe(false);
    expect(read("lib/discovery-engine.ts")).toContain("isSecretSetting(row.key)");
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

  it("names the residue as what the measurement found, not as fourteen dead switches", () => {
    // Measured 2026-11-03: none of the fourteen reaches a customer page, but the old house's own
    // tabs do read and write them — so the desk says «مفيش شاشة بتعرضها للعميل», which is what held.
    expect(desk).toContain("ومفيش شاشة بتعرضها للعميل");
    expect(desk).toContain("ولا سطر منها بيبان في صفحة عميل");
    expect(desk).not.toContain("وما بيقرأهاش أي سطح");
    expect(desk).toContain("residue.map");
    expect(desk).toContain("مسحها كلمة");
  });

  it("has a state line for every shape the registry says a value has", () => {
    // A new kind with no branch here silently prints «متضبط» for a value that could be empty.
    const shapes = Array.from(new Set(LIVE_FACTS.map((f) => f.kind)));
    for (const kind of shapes) {
      if (kind === "object" || kind === "secret-object") continue;
      expect(desk, kind).toContain(`fact.kind === "${kind}"`);
    }
  });

  it("writes the stamp's day in his digits, not the record's", () => {
    // Measured on the published desk 2026-11-04: the nightly stamp holds «2026-11-04», and printing
    // it as it is stored put eight Latin digits on his screen. A date identifies; it is not summed.
    expect(desk).toContain("arDigits(String(stamp.day))");
    expect(desk).not.toContain("يوم ${String(stamp.day)}");
  });

  it("carries no erase button — deleting a stored value is the owner's word", () => {
    expect(desk).not.toContain("DELETE");
    expect(desk).not.toMatch(/method:\s*"DELETE"/);
  });
});
