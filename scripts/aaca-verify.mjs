/**
 * Start AACA, wait for /api/v1/health, print result, stop process.
 * Usage: npm run aaca:verify
 */

import { spawn } from "child_process";
import { config } from "dotenv";

config({ path: ".env.local" });

const port = process.env.AACA_PORT || "3100";
const base = `http://127.0.0.1:${port}`;
const healthUrl = `${base}/api/v1/health`;
const maxWaitMs = 120_000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth() {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        const body = await res.json();
        return { ok: true, body };
      }
    } catch {
      // server still booting
    }
    await sleep(2000);
  }
  return { ok: false, error: "timeout" };
}

const child = spawn(
  "npm",
  ["run", "aaca:start"],
  {
    cwd: process.cwd(),
    shell: true,
    env: { ...process.env, AACA_PORT: port },
    stdio: ["ignore", "pipe", "pipe"],
  }
);

let logs = "";
child.stdout?.on("data", (d) => {
  logs += d.toString();
});
child.stderr?.on("data", (d) => {
  logs += d.toString();
});

console.log(`Starting AACA on port ${port}...`);

const result = await waitForHealth();

if (!result.ok) {
  console.error("AACA health check failed:", result.error);
  console.error(logs.slice(-4000));
  child.kill("SIGTERM");
  process.exit(1);
}

console.log("AACA health OK:", JSON.stringify(result.body, null, 2));

const root = await fetch(base).then((r) => r.json()).catch(() => null);
if (root) {
  console.log("AACA root:", root.status, root.name);
}

child.kill("SIGTERM");
await sleep(1500);
console.log("AACA verify complete.");
process.exit(0);
