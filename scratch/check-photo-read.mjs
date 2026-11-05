import { chromium } from "@playwright/test";

/**
 * What a customer is told when they like a picture and the store cannot read it.
 *   node scratch/check-photo-read.mjs [base]
 *
 * Pass one answers the picture door with the honest no-reading payload, so the screen's absence
 * state is looked at rather than assumed: no style badge, no «استايل undefined», and a sentence
 * that says the reading did not happen. Pass two lets the real door answer and reads what came
 * back. The absence is forced because a key cannot be made to go away on demand — the reading
 * itself is not.
 */
const BASE = process.argv[2] || "http://127.0.0.1:3223";

const NO_READ = {
  success: true,
  read: false,
  answered_by: "قواعد المتجر — من غير مفتاح",
  analysis: {
    read: false,
    style: null,
    styleAr: null,
    description: "",
    suggestions: [
      { id: "living-room", name: "غرفة المعيشة", url: "/rooms/living-room" },
      { id: "kitchen", name: "المطبخ", url: "/rooms/kitchen" },
    ],
    message: "ما قدرناش نقرا الصورة دلوقتي، والمتجر ما بيخترعش وصف. دي صورة من غرفة النوم الرئيسية، واللي تحتها غرف تانية من المعرض.",
  },
};

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

const readModal = () =>
  page.evaluate(() => {
    const dialog = [...document.querySelectorAll("div")].find((d) => d.className.includes("fixed") && d.querySelector("img"));
    const text = dialog?.innerText ?? "";
    const badge = [...(dialog?.querySelectorAll("div") ?? [])].find((d) => String(d.className).includes("absolute") && String(d.className).includes("rounded-full"));
    return {
      found: Boolean(dialog),
      badge: badge?.textContent?.trim() ?? null,
      cta: [...(dialog?.querySelectorAll("button") ?? [])].map((b) => b.textContent?.trim()).filter(Boolean).slice(0, 4),
      mentionsUndefined: /undefined|null|NaN/.test(text),
      latin: (text.match(/[A-Za-z]{3,}/g) ?? []).slice(0, 8),
      excerpt: text.replace(/\s+/g, " ").slice(0, 220),
    };
  });

const clickLike = async (nth) => {
  const likes = page.locator("button", { hasText: "أعجبني" });
  const count = await likes.count();
  if (count === 0) throw new Error("no like button on the page — nothing was measured");
  const target = likes.nth(Math.min(nth, count - 1));
  await target.scrollIntoViewIfNeeded();
  await target.click();
  // Wait for the dialog itself, not for a sentence: the honest absence and a real reading do not
  // share a word, and waiting on one of them silently waits on the wrong screen.
  await page.waitForFunction(
    () => [...document.querySelectorAll("div")].some((d) => String(d.className).includes("fixed") && d.querySelector("img")),
    null,
    { timeout: 60000 }
  );
  return count;
};

try {
  await page.goto(`${BASE}/rooms/living-room`, { waitUntil: "domcontentloaded", timeout: 120000 });
  // Waiting for any `button` timed out on a real page: the first one is a hidden language switch,
  // and Playwright waits for visibility. Wait for the control this measurement is about.
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("أعجبني")),
    null,
    { timeout: 90000 }
  );
  const likes = await page.locator("button", { hasText: "أعجبني" }).count();
  console.log("like buttons on the page:", likes);

  await page.route("**/api/analyze-image", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(NO_READ) })
  );
  await clickLike(0);
  const absence = await readModal();
  console.log("when the reading is absent:", JSON.stringify(absence, null, 1));
  await page.screenshot({ path: "scratch/photo-read-absent.png" });
  await page.unroute("**/api/analyze-image");

  // Close the first modal and prove it is gone before asking a second question: the absence text
  // is still in the document while it is open, so a wait on that text answers instantly and reads
  // a stale screen — which is exactly how a false pass gets reported.
  const close = page.locator("svg.lucide-x").first();
  if (await close.count()) await close.click();
  await page.waitForFunction(() => !document.body.innerText.includes("ما قدرناش"), null, { timeout: 20000 });

  const answered = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/analyze-image")) answered.push(r.status());
  });
  await clickLike(3);
  // `waitForFunction` runs in the page and cannot see a Node-side array; wait on the response.
  const response = await page
    .waitForResponse((r) => r.url().includes("/api/analyze-image"), { timeout: 90000 })
    .catch(() => null);
  const read = await readModal();
  console.log("the real door answered with status:", JSON.stringify(answered), "and the screen says:", JSON.stringify(read, null, 1));
  await page.screenshot({ path: "scratch/photo-read-real.png" });

  const verdict = {
    noBadgeWhenAbsent: absence.badge === null || absence.badge === "",
    noUndefinedOnEitherScreen: !absence.mentionsUndefined && !read.mentionsUndefined,
    absenceSaysItCouldNotRead: /ما قدرناش/.test(absence.excerpt),
    absenceClaimsNoTaste: !absence.excerpt.includes("ذوقك"),
    realDoorAnswered: answered.length === 1 && answered[0] === 200 && read.found,
  };
  console.log("verdict:", JSON.stringify(verdict, null, 1));
  process.exitCode = Object.values(verdict).every(Boolean) ? 0 : 1;
} finally {
  await browser.close();
}
