/**
 * The golden pre-call dossier: the rules that keep it worth dialling from.
 *
 * Two of the five things the plan asked this screen to show have no source in this store, so
 * the first job of this suite is to make sure the file says so instead of filling the gap. The
 * second is the store's own language law: the columns behind this screen are not clean. The
 * live read of 2026-10-02 (23 profile rows) found «Kids Bedroom» and «مجلس رجال» in the same
 * column, the page slug «elite-brief» stored as a style, and budgets written as «120k-200k».
 * The corpus below is that measurement, frozen — these tests assert against what the store
 * actually holds, not against a tidy fixture.
 */
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

import { arabicOnly, budgetLabel, buildDossier, paperPath, type DossierSketch } from "@/lib/cad/dossier";
import { rollCustomers, type CustomerRow, type RawRow } from "@/lib/customers/roll";
import { arNum } from "@/lib/ops/metricLabels";
import type { SheetImage } from "@/lib/cad/sheet-images";

/** His numerals, built from their code points — a hand-typed digit table is how this broke before. */
const ZERO = 0x0660;
const ar = (n: number) => String(n).split("").map((d) => String.fromCharCode(ZERO + Number(d))).join("");

/** Arabic script plus two or more Latin letters in one run of text: unreadable on his phone. */
const mixed = (s: string) => /\p{Script=Arabic}/u.test(s) && /[A-Za-z]{2,}/.test(s);

const NOW = new Date().toISOString();
const PHONE = "01005556677";

function lineOf(over: Partial<RawRow> = {}): CustomerRow {
  return rollCustomers([{ space: "profile", phone: PHONE, name: "سيف", at: NOW, ...over }])[0];
}

function sketchOf(over: Partial<DossierSketch> = {}): DossierSketch {
  return {
    id: 1,
    token: "k7qm2x9dw4f8az3e",
    room: "مجلس رجال",
    dimensions: [
      { label: "الطول", meters: 5.2, confirmed: true },
      { label: "العرض", meters: 4.1, confirmed: false },
    ],
    area_sqm: 21.32,
    ok: true,
    confirmed_at: null,
    frozen_hash: null,
    created_at: NOW,
    ...over,
  };
}

const imageOf = (color: string | null, roomType = "living-room"): SheetImage => ({
  id: 1,
  url: "https://images.example/one.jpg",
  thumb: "https://images.example/one.jpg",
  style: "نيوكلاسيك",
  roomType,
  color,
});

/** The browsing section for one stated thing he was looking at. */
const tasteOf = (over: Partial<NonNullable<RawRow["looking"]>> = {}) => {
  const file = buildDossier({
    line: lineOf({ looking: { roomType: null, style: null, serviceType: null, lastPage: null, ...over } }),
    sketches: [],
    images: [],
    imagesRoomType: "living-room",
    imagesForHisRoom: false,
  });
  return file.sections.find((s) => s.id === "taste")?.facts ?? [];
};

const areaOf = (file: ReturnType<typeof buildDossier>) =>
  file.sections.find((s) => s.id === "paper")?.facts.find((f) => f.label === "المساحة")?.value ?? "";

/** Every spelling the store's own columns produced, measured 2026-10-02. */
const CORPUS = {
  roomTypes: ["Kids Bedroom", "Kitchen", "مجلس رجال", "Full Unit", "Dressing Room", "غرف النوم الرئيسية", "Guest Bedroom", "المنزل بالكامل", "Master Bedroom", "master-bedroom", "corner-sofa"],
  styles: ["elite-brief", "نيوكلاسيك", "هادئ فاخر", "مودرن (Modern)"],
  serviceTypes: ["1-3 Months", "3-6 Months", "Immediate", "Flexible", "تصميم فقط", "تصميم وتنفيذ", "فيلا"],
  lastPages: ["/elite-brief", "/request", "/some-new-page"],
  budgets: ["120k-200k", "80k-150k", "300k+", "3M-5M", "1.5M-3M", "5,500 - 12,000 EGP", "فئة النخبة (Ultra-Luxury) - فيلات وقصور ومواصفات خاصة جداً"],
  intents: ["browsing", "buyer", "interested"],
};

const everything = (): string[] => {
  const out: string[] = [];
  let n = 0;
  for (const roomType of CORPUS.roomTypes)
    for (const style of CORPUS.styles)
      for (const serviceType of CORPUS.serviceTypes)
        for (const lastPage of CORPUS.lastPages) {
          // Budget and intent ride along by index rather than as a fifth and sixth loop:
          // the cross product would be 19,404 files, and every value is exercised either way.
          const budget = CORPUS.budgets[n % CORPUS.budgets.length];
          const intent = CORPUS.intents[n % CORPUS.intents.length];
          n++;
          const file = buildDossier({
            line: lineOf({
              budget,
              intent,
              looking: { roomType, style, serviceType, lastPage },
            }),
            sketches: [sketchOf()],
            images: [imageOf("#3b2f2a"), imageOf(null)],
            imagesRoomType: "living-room",
            imagesForHisRoom: true,
          });
          for (const section of file.sections) {
            out.push(section.title);
            for (const fact of section.facts) out.push(fact.label, fact.value);
            for (const missing of section.missing ?? []) out.push(missing);
          }
          out.push(file.headline);
        }
  return out;
};

describe("the dossier speaks only the owner's language", () => {
  it("walks the whole measured corpus", () => {
    // A guard that scans nothing passes vacuously.
    expect(everything().length).toBeGreaterThan(1000);
  });

  it("never puts a Latin run inside an Arabic line", () => {
    const offenders = [...new Set(everything())].filter(mixed);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("never prints a path or a colour code as text", () => {
    // The sheet link and the hexes are the screen's business (an href, a swatch), not prose.
    const printed = everything();
    expect(printed.filter((s) => s.includes("/passport/"))).toEqual([]);
    expect(printed.filter((s) => s.includes("#3b2f2a"))).toEqual([]);
    expect(printed.filter((s) => s.includes("http"))).toEqual([]);
  });

  it("names a room in Arabic whatever spelling the column holds", () => {
    expect(arabicOnly("Kids Bedroom")).toBe("غرف الأطفال");
    expect(arabicOnly("master-bedroom")).toBe("غرفة النوم الرئيسية");
    expect(arabicOnly("مجلس رجال")).toBe("مجلس رجال");
    expect(arabicOnly("مودرن (Modern)")).toBe("مودرن");
  });

  it("prints a room for every spelling the store's own column holds", () => {
    // The negative this catches: a slug that stops matching is silently dropped, and the file
    // just gets shorter — which no Latin check would ever see.
    for (const roomType of CORPUS.roomTypes) {
      const file = buildDossier({
        line: lineOf({ looking: { roomType, style: null, serviceType: null, lastPage: null } }),
        sketches: [],
        images: [],
        imagesRoomType: "living-room",
        imagesForHisRoom: false,
      });
      const room = file.sections.find((s) => s.id === "taste")?.facts.find((f) => f.label === "الغرفة اللي بيدوّر عليها");
      expect(room?.value, roomType).toBeTruthy();
      expect(mixed(room?.value ?? ""), roomType).toBe(false);
    }
  });

  it("drops a Latin word it has no Arabic name for instead of printing the slug", () => {
    expect(arabicOnly("elite-brief")).toBeNull();
    expect(arabicOnly("Polo Ralph Lauren")).toBeNull();
    expect(arabicOnly("   ")).toBeNull();
    expect(arabicOnly(null)).toBeNull();
  });

  it("reads the money the site's own form writes, and says nothing about the rest", () => {
    expect(budgetLabel("120k-200k")).toBe(`من ${ar(120)} إلى ${ar(200)} ألف جنيه`);
    expect(budgetLabel("3M-5M")).toBe(`من ${ar(3)} إلى ${ar(5)} مليون جنيه`);
    expect(budgetLabel("300k+")).toBe(`أكثر من ${ar(300)} ألف جنيه`);
    expect(budgetLabel("1.5M-3M")).toContain("مليون");
    expect(budgetLabel("5,500 - 12,000 EGP")).toContain("جنيه");
    expect(mixed(budgetLabel("5,500 - 12,000 EGP") ?? "")).toBe(false);
    // A Latin range this cannot parse is dropped, never printed half-translated.
    expect(budgetLabel("USD 5000")).toBeNull();
  });

  it("does not call a service a deadline, or a deadline a service", () => {
    // One column, two kinds of answer — measured: «1-3 Months» and «تصميم وتنفيذ» sit in it
    // together. Labelling both «وقته» is how a file starts being disbelieved.
    const timing = tasteOf({ serviceType: "1-3 Months" });
    expect(timing.find((f) => f.label === "وقته")?.value).toBe("في تلات شهور");
    expect(timing.find((f) => f.label === "الخدمة اللي طلبها")).toBeUndefined();

    const service = tasteOf({ serviceType: "تصميم وتنفيذ" });
    expect(service.find((f) => f.label === "الخدمة اللي طلبها")?.value).toBe("تصميم وتنفيذ");
    expect(service.find((f) => f.label === "وقته")).toBeUndefined();

    const flexible = tasteOf({ serviceType: "Flexible" });
    expect(flexible.find((f) => f.label === "وقته")?.value).toBe("وقته مفتوح");
  });

  it("names the pages the store recorded and drops the ones it did not", () => {
    expect(tasteOf({ lastPage: "/request" }).find((f) => f.label === "آخر صفحة وقف عندها")?.value).toBe("اطلب عرض");
    expect(tasteOf({ lastPage: "/some-new-page" }).find((f) => f.label === "آخر صفحة وقف عندها")).toBeUndefined();
  });

  it("keeps the man and drops the tag the site's own form glued to his name", () => {
    // Measured live 2026-10-02: the roll carries «السيد طارق الدسوقي (VIP - فيلا ميفيدا)».
    const file = buildDossier({
      line: lineOf({ name: "السيد طارق الدسوقي (VIP - فيلا ميفيدا)" }),
      sketches: [],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: false,
    });
    const name = file.sections[0].facts.find((f) => f.label === "الاسم")?.value ?? "";
    expect(name).toBe("السيد طارق الدسوقي فيلا ميفيدا");
    expect(file.headline.startsWith(name)).toBe(true);
  });

  it("leaves a Latin-only name whole instead of dropping the caller", () => {
    const file = buildDossier({ line: lineOf({ name: "John Smith" }), sketches: [], images: [], imagesRoomType: "living-room", imagesForHisRoom: false });
    const name = file.sections[0].facts.find((f) => f.label === "الاسم")?.value ?? "";
    expect(name).toBe("John Smith");
    // A line with no Arabic in it does not flip the rendering, so this one is allowed.
    expect(mixed(name)).toBe(false);
  });

  it("names a measure in Arabic, or calls it a side", () => {
    const file = buildDossier({
      line: lineOf(),
      sketches: [sketchOf({ dimensions: [
        { label: "الطول", meters: 4.5, confirmed: true },
        { label: "length", meters: 3.2, confirmed: true },
      ] })],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: false,
    });
    const dims = file.sections.find((s) => s.id === "paper")?.facts.find((f) => f.label === "الأبعاد")?.value ?? "";
    expect(dims).toContain("الطول");
    expect(dims).toContain("ضلع");
    expect(mixed(dims)).toBe(false);
  });

  it("multiplies only the two sides that say which they are", () => {
    const withNames = buildDossier({
      line: lineOf(),
      sketches: [sketchOf({
        area_sqm: null,
        dimensions: [
          { label: "الطول", meters: 4.5, confirmed: true },
          { label: "العرض", meters: 3.2, confirmed: true },
        ],
      })],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: false,
    });
    expect(areaOf(withNames)).toBe(`${arNum(14.4)} متر مربع`);

    // The number the store really holds: two sides, both agreed, neither named. The drawing walks
    // them as the room's length and width, and the file prints the area of what it drew.
    const blind = buildDossier({
      line: lineOf(),
      sketches: [sketchOf({
        area_sqm: null,
        dimensions: [
          { label: "من الورقة", meters: 4.5, confirmed: true },
          { label: "من الورقة", meters: 3.2, confirmed: true },
        ],
      })],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: false,
    });
    expect(areaOf(blind)).toBe(`${arNum(14.4)} متر مربع`);

    // One number is not a room whatever its label says, and no area comes out of it.
    const oneSided = buildDossier({
      line: lineOf(),
      sketches: [sketchOf({
        area_sqm: null,
        dimensions: [{ label: "الطول", meters: 4.5, confirmed: true }],
      })],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: false,
    });
    expect(areaOf(oneSided)).toContain("متحسبتش");
  });

  it("prints the area of the room it drew, not a product of its own choosing", () => {
    // The two surfaces must not disagree: the customer's sheet shows ١٤٫٤ under a closed drawing,
    // so the owner's file for the same paper cannot say the area was never computed.
    const file = buildDossier({
      line: lineOf(),
      sketches: [sketchOf({ area_sqm: null, dimensions: [
        { label: "الطول", meters: 5.2, confirmed: true },
        { label: "العرض", meters: 4.1, confirmed: false },
      ] })],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: false,
    });
    expect(areaOf(file)).toBe(`${arNum(21.32)} متر مربع`);
    expect(file.plan?.complete).toBe(true);
    expect(file.sections.find((s) => s.id === "paper")?.facts.find((f) => f.label === "شكل المكان")?.value)
      .toContain("مستطيل");
  });

  it("writes his digits, not the machine's", () => {
    const file = buildDossier({ line: lineOf(), sketches: [sketchOf()], images: [], imagesRoomType: "living-room", imagesForHisRoom: true });
    expect(file.headline).toContain(`${ar(1)} ورقة`);
    const phone = file.sections[0].facts.find((f) => f.label === "الموبايل")?.value ?? "";
    expect(phone).toContain(ar(1));
    expect(/[0-9]/.test(phone)).toBe(false);
    // The trunk zero belongs to the number he dials. The stored key drops it deliberately, so a
    // fact line that prints the key tells the owner to dial digits that never connect.
    expect(phone).toBe(`${ar(0)}${ar(1005556677)}`);
  });
});

describe("the dossier refuses to invent", () => {
  it("prints the two unknowns even when everything else is there", () => {
    const file = buildDossier({
      line: lineOf({ budget: "120k-200k", intent: "buyer", looking: { roomType: "مجلس رجال", style: "نيوكلاسيك", serviceType: "Immediate", lastPage: "/request" } }),
      sketches: [sketchOf({ confirmed_at: NOW, frozen_hash: "sha256:1", dimensions: [{ label: "الطول", meters: 5.2, confirmed: true }] })],
      images: [imageOf("#3b2f2a")],
      imagesRoomType: "living-room",
      imagesForHisRoom: true,
    });
    const missing = file.sections.find((s) => s.id === "missing")?.missing ?? [];
    expect(missing).toHaveLength(2);
    expect(missing.join(" ")).toContain("منطقته الجغرافية");
    expect(missing.join(" ")).toContain("مفيش سجل مشاهدة");
  });

  it("says there is no paper rather than describing one", () => {
    const file = buildDossier({ line: lineOf(), sketches: [], images: [], imagesRoomType: "living-room", imagesForHisRoom: false });
    const paper = file.sections.find((s) => s.id === "paper")?.facts ?? [];
    expect(paper.map((f) => f.value).join(" ")).toContain("مفيش ورقة متصورة له");
    expect(paper.some((f) => f.label === "الأبعاد")).toBe(false);
    expect(file.headline).toContain(`${ar(0)} ورقة`);
  });

  it("carries the area he typed, and stops calling it unknown", () => {
    const silent = buildDossier({ line: lineOf(), sketches: [sketchOf()], images: [], imagesRoomType: "living-room", imagesForHisRoom: true });
    expect(silent.sections.find((s) => s.id === "missing")?.missing.join(" ")).toContain("منطقته الجغرافية");

    const told = buildDossier({ line: lineOf(), sketches: [sketchOf({ customer_city: "التجمع الخامس" })], images: [], imagesRoomType: "living-room", imagesForHisRoom: true });
    const paper = told.sections.find((s) => s.id === "paper")?.facts ?? [];
    expect(paper.find((f) => f.label === "منطقته من ورقته")?.value).toBe("التجمع الخامس");
    expect(told.sections.find((s) => s.id === "missing")?.missing.join(" ")).not.toContain("منطقته الجغرافية");
  });

  it("names the door his area came from, and shows a disagreement instead of picking one", () => {
    const said = { roomType: null, style: null, serviceType: null, lastPage: null, area: "الشيخ زايد" };
    const onlyWords = buildDossier({ line: lineOf({ looking: said }), sketches: [sketchOf()], images: [], imagesRoomType: "living-room", imagesForHisRoom: true });
    const taste = onlyWords.sections.find((s) => s.id === "taste")?.facts ?? [];
    expect(taste.find((f) => f.label === "منطقته من كلامه")?.value).toBe("الشيخ زايد");
    // His sentence alone closes the «unknown area» line: the store really does know it now.
    expect(onlyWords.sections.find((s) => s.id === "missing")?.missing.join(" ")).not.toContain("منطقته الجغرافية");

    const both = buildDossier({
      line: lineOf({ looking: said }),
      sketches: [sketchOf({ customer_city: "التجمع" })],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: true,
    });
    const clash = (both.sections.find((s) => s.id === "taste")?.facts ?? []).find((f) => f.label === "منطقته");
    expect(clash?.value).toContain("كلامه يقول الشيخ زايد");
    expect(clash?.value).toContain("اسأله");

    const agree = buildDossier({
      line: lineOf({ looking: { ...said, area: "التجمع" } }),
      sketches: [sketchOf({ customer_city: "التجمع" })],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: true,
    });
    const same = (agree.sections.find((s) => s.id === "taste")?.facts ?? []).find((f) => f.label === "منطقته");
    expect(same?.value).toBe("التجمع — قالها في كلامه وعلى ورقته");
  });
  it("keeps the general house palette labelled as the general house palette", () => {
    const file = buildDossier({ line: lineOf(), sketches: [sketchOf({ room: "حديقة شتوية" })], images: [imageOf("#3b2f2a", "comprehensive-interior")], imagesRoomType: "comprehensive-interior", imagesForHisRoom: false });
    expect(file.sections.find((s) => s.id === "colours")?.title).toContain("مكانه مش في البنك");
  });

  it("says the bank stored no colour instead of showing an empty row", () => {
    const file = buildDossier({ line: lineOf(), sketches: [sketchOf()], images: [imageOf(null)], imagesRoomType: "living-room", imagesForHisRoom: true });
    const colours = file.sections.find((s) => s.id === "colours");
    expect(colours?.swatches).toEqual([]);
    expect(colours?.missing?.[0]).toContain("ما بيخزّنش لون");
  });

  it("calls a browsing-less customer browsing-less", () => {
    const file = buildDossier({ line: lineOf({ looking: null }), sketches: [], images: [], imagesRoomType: "living-room", imagesForHisRoom: false });
    const taste = file.sections.find((s) => s.id === "taste");
    expect(taste?.facts).toEqual([]);
    expect(taste?.missing?.[0]).toContain("ما سجلش عنه حاجة");
  });

  it("asks for a name before it builds anybody's file", () => {
    const file = buildDossier({ line: null, sketches: [], images: [], imagesRoomType: "living-room", imagesForHisRoom: false });
    expect(file.headline).toBe("اختار عميل من الدفتر الأول");
  });
});

describe("the paper section says what the paper says", () => {
  it("counts the numbers he vouched for and names the seal", () => {
    const file = buildDossier({
      line: lineOf(),
      sketches: [sketchOf({ confirmed_at: NOW, frozen_hash: "sha256:9" })],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: true,
    });
    const agreement = file.sections.find((s) => s.id === "paper")?.facts.find((f) => f.label === "اتفاقك معه")?.value ?? "";
    expect(agreement).toBe(`أكد ${ar(1)} من ${ar(2)} مقاس والورقة مختومة`);
  });

  it("tells him to send the sheet while nothing is confirmed", () => {
    const file = buildDossier({ line: lineOf(), sketches: [sketchOf()], images: [], imagesRoomType: "living-room", imagesForHisRoom: true });
    const agreement = file.sections.find((s) => s.id === "paper")?.facts.find((f) => f.label === "اتفاقك معه")?.value ?? "";
    expect(agreement).toContain("لسه ماأكدش");
  });

  it("owns an unread paper instead of hiding it", () => {
    const file = buildDossier({ line: lineOf(), sketches: [sketchOf({ ok: false })], images: [], imagesRoomType: "living-room", imagesForHisRoom: true });
    const paper = file.sections.find((s) => s.id === "paper")?.facts ?? [];
    expect(paper.some((f) => f.value.includes("ما اتقراش"))).toBe(true);
  });

  it("keeps the sheet link a path and nothing more", () => {
    expect(paperPath("k7qm2x9dw4f8az3e")).toBe("/passport/k7qm2x9dw4f8az3e");
  });
});

describe("the dossier is wired, not decorative", () => {
  const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf8") : "");
  const DOOR = "app/api/admin/customers/dossier/route.ts";
  const SCREEN = "components/admin/ClientPreCallDossier.tsx";
  const PAGE = "app/admin/v2/sales/page.tsx";

  it("reads the roll through the one reader the customers screen uses", () => {
    const door = read(DOOR);
    expect(door.length, "the dossier door was not created").toBeGreaterThan(500);
    expect(door).toContain("readCustomers");
    expect(door).toContain("buildDossier");
  });

  it("scopes his papers to this store in the same statement that reads them", () => {
    const door = read(DOOR);
    expect(door).toContain('.eq("company_id", companyId)');
    expect(door).toContain('.eq("customer_key", wanted.key)');
  });

  it("refuses a malformed key instead of returning an empty file", () => {
    // An empty dossier reads to the owner as «nothing on this man», which is a different lie.
    expect(read(DOOR)).toContain('status: 400');
  });

  it("is mounted on the sales office and searches the real roll", () => {
    const screen = read(SCREEN);
    expect(screen).toContain("matchRoll");
    expect(screen).toContain("/api/admin/customers/dossier");
    expect(screen).toContain("الدفتر ما ردّش");
    expect(read(PAGE)).toContain("<ClientPreCallDossier");
  });
});

describe("اللي العائلة اختارته", () => {
  const VOTES = [
    { image_key: "i1", image_url: "https://images.example/one.jpg", voter: "مراتي", liked: true, updated_at: NOW },
    { image_key: "i1", image_url: "https://images.example/one.jpg", voter: "أحمد", liked: true, updated_at: NOW },
    { image_key: "i2", image_url: "https://images.example/two.jpg", voter: "مراتي", liked: false, updated_at: NOW },
  ];

  const familyOf = (votes: typeof VOTES | undefined) =>
    buildDossier({
      line: lineOf(),
      sketches: [sketchOf()],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: false,
      votes,
    }).sections.find((s) => s.id === "family");

  it("names who voted and shows the picture they kept stopping on", () => {
    const family = familyOf(VOTES);
    expect(family?.facts.map((f) => f.value)).toContain("مراتي، أحمد");
    expect(family?.picks).toHaveLength(1);
    expect(family?.picks?.[0].likes).toBe(2);
    expect(family?.missing).toBeUndefined();
  });

  it("retires the unknown line once the family has spoken", () => {
    const file = buildDossier({
      line: lineOf(),
      sketches: [sketchOf()],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: false,
      votes: VOTES,
    });
    const missing = file.sections.find((s) => s.id === "missing")?.missing ?? [];
    expect(missing.join(" ")).not.toContain("أكثر القطع");
  });

  it("says nobody voted, and keeps the unknown line, when the room is empty", () => {
    const family = familyOf([]);
    expect(family?.facts).toEqual([]);
    expect(family?.picks).toBeUndefined();
    expect(family?.missing?.[0]).toContain("أحبها");
    const file = buildDossier({
      line: lineOf(),
      sketches: [sketchOf()],
      images: [],
      imagesRoomType: "living-room",
      imagesForHisRoom: false,
    });
    expect((file.sections.find((s) => s.id === "missing")?.missing ?? []).join(" ")).toContain("أكثر القطع");
  });

  it("prints no machine value in the family section", () => {
    const family = familyOf(VOTES)!;
    const printed = family.facts.map((f) => f.value).join(" ");
    expect(printed).not.toMatch(/https?:|#[0-9a-fA-F]{6}|i\d+/);
    expect(printed).not.toMatch(/[A-Za-z]{3,}/);
  });
});
