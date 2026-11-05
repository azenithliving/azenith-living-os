import { execFileSync } from "node:child_process";

// Waits until the deployment that is READY is the one carrying the commit just pushed.
// Measured 2026-11-04: the first version declared success on the *previous* READY deployment,
// because it only looked at deployments[0].state and never at which commit that build was.
const want = execFileSync("git", ["log", "-1", "--format=%H|%s"], { encoding: "utf8" }).trim();
const wantSha = want.split("|")[0];
const wantSubject = want.split("|").slice(1).join("|").slice(0, 48);
console.log("waiting for build of: " + wantSha.slice(0, 8) + " · " + wantSubject);

for (let i = 1; i <= 40; i++) {
  let list;
  try {
    const out = execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--no-install", "vercel", "ls", "--json"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      shell: true,
    });
    list = JSON.parse(out.slice(out.indexOf("{"))).deployments ?? [];
  } catch (e) {
    console.log(`محاولة ${i}: قراءة القائمة فشلت: ${String(e).slice(0, 120)}`);
    await new Promise((r) => setTimeout(r, 20000));
    continue;
  }

  // This project's deployments report githubCommitRef as the branch name, not the sha (measured
  // 2026-11-04), so the build is matched by the subject line of the commit that triggered it.
  const subject = (d) => ((d.meta?.githubCommitMessage ?? "").split("\n")[0] ?? "").slice(0, wantSubject.length);
  const mine = list.find((d) => subject(d) === wantSubject);
  const newest = list[0];
  const seen = newest ? `${newest.url} · حالة ${newest.state} · ${subject(newest).slice(0, 40)}` : "ولا نسخة";
  console.log(`محاولة ${i}: الأحدث ${seen}`);

  if (mine) {
    if (mine.state === "READY") {
      console.log(`PUBLISHED url=${mine.url} subject=${subject(mine).slice(0, 40)}`);
      process.exit(0);
    }
    if (mine.state === "ERROR" || mine.state === "CANCELED") {
      console.log("BUILD FAILED state=" + mine.state + " subject=" + subject(mine).slice(0, 40));
      process.exit(1);
    }
  }
  await new Promise((r) => setTimeout(r, 20000));
}
console.log("البناء ما وصلش للنسخة المطلوبة في المهلة");
process.exit(2);
