/**
 * Does the drawing reach a real phone — and does a thumb move a door without breaking the seal?
 *   node scratch/check-room-plan.mjs [base]
 *
 * Raises a throwaway paper the way the store raises one (numbers on the row, no drawing stored
 * yet), opens it at 390px, confirms the numbers through the customer's own button, drags the door
 * along its wall, reloads, and reads back: what the sheet painted, what the table now holds, and
 * whether his signature still matches. The throwaway row is deleted at the end.
 *
 * Credentials are read from the environment and never printed.
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || "http://localhost:3223";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
  .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
  .join("");

const dimensions = [
  { label: "الطول", meters: 4.5, confirmed: false },
  { label: "العرض", meters: 3.2, confirmed: false },
];

await db.$executeRaw`insert into public.room_sketches (room, ok, token, dimensions, openings, area_sqm, plan, created_at)
  values (${"صالة معيشة"}, false, ${token}, ${JSON.stringify(dimensions)}::jsonb, ${JSON.stringify([{ kind: "door", widthMeters: 0.9 }])}::jsonb, null, null, now())`;
const [paper] = await db.$queryRaw`select id from public.room_sketches where token = ${token}`;
const paperId = Number(paper.id);
console.log(`throwaway paper id=${paperId}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
let pressBox = null;
let pressHit = null;
// What the drawing door actually answered — a silent no-change is only honest once you know
// whether the store refused it, throttled it, or never saw the request.
const planAnswers = [];
page.on("response", async (res) => {
  if (res.url().includes("/plan")) {
    planAnswers.push({ status: res.status(), body: String(await res.text().catch(() => "")).slice(0, 160) });
  }
});
const shots = [];
const snap = async (name) => {
  const path = `scratch/plan-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  shots.push(path);
};

const readSheet = () =>
  page.evaluate(() => {
    const walls = [...document.querySelectorAll("[data-plan-wall]")];
    return {
      hasSheet: Boolean(document.querySelector("[data-plan-sheet]")),
      shape: document.querySelector("[data-plan-sheet]")?.getAttribute("viewBox") ?? null,
      walls: walls.length,
      solid: walls.filter((w) => w.getAttribute("data-plan-wall-confirmed") === "1").length,
      offset: document.querySelector("[data-plan-opening^='door']")?.getAttribute("data-plan-opening-offset") ?? null,
      implied: document.querySelector("[data-plan-implied]")?.textContent ?? null,
      legend: document.querySelector("[data-plan-legend]")?.textContent ?? null,
      area: document.body.textContent?.match(/المساحة الحسابية:\s*([\d٠-٩٫.]+)\s*متر مربع/)?.[1] ?? null,
      sealed: document.body.textContent?.includes("دي ورقتك المعتمدة") ?? false,
      unchanged: document.body.textContent?.includes("مختومة ومفيش حاجة اتغيرت بعدها") ?? false,
      moved: document.body.textContent?.includes("اتغيرت بعد اعتمادك") ?? false,
      missing: document.querySelector("[data-plan-missing]")?.textContent ?? null,
    };
  });

try {
  // 1. the paper before he says anything: a drawing exists even though none was stored.
  await page.goto(`${BASE}/passport/${token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-plan-block]", { timeout: 30000 });
  const before = await readSheet();
  console.log("before confirming:", JSON.stringify(before, null, 1));
  await snap("1-before");

  // 2. he types his own numbers — the witness that always answers.
  const inputs = page.locator("input[placeholder^='مقاس']");
  await inputs.nth(0).fill("4.5");
  await inputs.nth(1).fill("3.2");
  await page.locator("button", { hasText: "أكّد مقاساتي" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("دي ورقتك المعتمدة"), null, { timeout: 30000 });
  const confirmed = await readSheet();
  console.log("after confirming:", JSON.stringify(confirmed, null, 1));
  await snap("2-confirmed");

  const [rowAfterConfirm] = await db.$queryRaw`select plan, area_sqm, frozen_hash, confirmed_at from public.room_sketches where id = ${paperId}`;
  const storedPlan = typeof rowAfterConfirm.plan === "string" ? JSON.parse(rowAfterConfirm.plan) : rowAfterConfirm.plan;
  console.log(
    `stored: walls=${storedPlan?.walls?.length ?? 0} solid=${(storedPlan?.walls ?? []).filter((w) => w.confirmed).length}` +
      ` area=${rowAfterConfirm.area_sqm} sidesOnPaper=${storedPlan?.sidesOnPaper} sealed=${Boolean(rowAfterConfirm.frozen_hash)}`
  );

  // 3. a thumb moves the door along its wall.
  const handle = page.locator("[data-plan-handle='0']");
  // The site's header is sticky, so a raw coordinate can land under it: scroll until the point a
  // finger would actually press is the door itself, which is what a customer on a phone does.
  // The site's header is sticky, and `scrollIntoViewIfNeeded` parks the door under it (measured:
  // the press hit the header at y=67). Centre it in the viewport instead — where a thumb scrolling
  // by hand would actually put it.
  let box = await handle.boundingBox();
  const onTheDoor = ([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest?.("g[role='slider']"));
  for (let tries = 0; tries < 6; tries++) {
    await page.evaluate(() => document.querySelector("[data-plan-handle]")?.scrollIntoView({ block: "center", inline: "center" }));
    await page.waitForTimeout(600);
    box = await handle.boundingBox();
    if (!box) break;
    if (await page.evaluate(onTheDoor, [box.x + box.width / 2, box.y + box.height / 2])) break;
  }
  if (!box || !(await page.evaluate(onTheDoor, [box.x + box.width / 2, box.y + box.height / 2]))) {
    console.log("warning: the door could not be brought under a clear press point");
  }
  pressBox = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  pressHit = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? `${el.tagName}${el.closest("g[role='slider']") ? " (in the door)" : " (NOT the door)"}` : "nothing";
    },
    [pressBox.x, pressBox.y]
  );
  await page.mouse.move(pressBox.x, pressBox.y);
  await page.mouse.down();
  await page.mouse.move(pressBox.x + 55, pressBox.y, { steps: 8 });
  await snap("3-dragging");
  await page.mouse.up();
  await page.waitForTimeout(2500);
  const dragged = await readSheet();
  console.log("after dragging:", JSON.stringify(dragged, null, 1));
  console.log(
    "the press itself:",
    JSON.stringify({
      answers: planAnswers,
      box: pressBox,
      hit: pressHit,
      movedBy: Number(dragged.offset) - Number(confirmed.offset),
    })
  );
  console.log("door answers seen:", JSON.stringify(planAnswers));

  // 4. reload: the place he put it has to come from the table, not from the phone.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-plan-block]", { timeout: 30000 });
  const reloaded = await readSheet();
  const [rowAfterDrag] = await db.$queryRaw`select plan, frozen_hash from public.room_sketches where id = ${paperId}`;
  const planAfterDrag = typeof rowAfterDrag.plan === "string" ? JSON.parse(rowAfterDrag.plan) : rowAfterDrag.plan;
  console.log("after reload:", JSON.stringify(reloaded, null, 1));
  console.log(`stored offset after reload: ${planAfterDrag?.openings?.[0]?.offsetMeters} · seal unchanged in the table: ${rowAfterDrag.frozen_hash === rowAfterConfirm.frozen_hash}`);
  await snap("4-reloaded");

  // 5. a paper with no numbers at all: the sheet must ask, not paint an empty box.
  const emptyToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
    .join("");
  await db.$executeRaw`insert into public.room_sketches (room, ok, token, dimensions, openings, created_at)
    values (${"غرفة"}, false, ${emptyToken}, ${JSON.stringify([])}::jsonb, ${JSON.stringify([])}::jsonb, now())`;
  const [emptyPaper] = await db.$queryRaw`select id from public.room_sketches where token = ${emptyToken}`;
  await page.goto(`${BASE}/passport/${emptyToken}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-plan-block]", { timeout: 30000 });
  const empty = await readSheet();
  console.log("a paper with nothing on it:", JSON.stringify({ hasSheet: empty.hasSheet, missing: empty.missing }));
  await snap("5-empty");
  await db.$executeRaw`delete from public.room_sketches where id = ${Number(emptyPaper.id)}`;

  const verdict = {
    drewBeforeConfirm: before.walls === 4 && before.hasSheet,
    impliedLine: Boolean(before.implied) && before.implied.includes("٢"),
    sealedAfterConfirm: confirmed.sealed && confirmed.solid === 4 && confirmed.unchanged,
    areaFromGeometry: String(rowAfterConfirm.area_sqm) === "14.4",
    doorMoved: dragged.offset !== null && Number(dragged.offset) > Number(confirmed.offset),
    doorPersisted: reloaded.offset === dragged.offset && String(planAfterDrag?.openings?.[0]?.offsetMeters) === String(reloaded.offset),
    sealSurvivedDrag: reloaded.sealed && reloaded.unchanged && !reloaded.moved && rowAfterDrag.frozen_hash === rowAfterConfirm.frozen_hash,
    emptyPaperAsks: !empty.hasSheet && Boolean(empty.missing),
  };
  console.log("verdict:", JSON.stringify(verdict, null, 1));
  console.log("screenshots:", shots.join(" "));
  process.exitCode = Object.values(verdict).every(Boolean) ? 0 : 1;
} finally {
  await db.$executeRaw`delete from public.room_sketches where id = ${paperId}`;
  await browser.close();
  await db.$disconnect();
}
