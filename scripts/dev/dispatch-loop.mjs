// Local stand-in for pg_cron: every 30 s, sends due notifications through the mock providers.
// node scripts/dev/dispatch-loop.mjs   (reads CRON_SECRET from .env.local; app running on :3000)
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) throw new Error("Set CRON_SECRET in .env.local (docs/env.md)");

async function run(job) {
  try {
    const res = await fetch(`${base}/api/internal/jobs/${job}`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    console.log(new Date().toISOString(), job, res.status, await res.text());
  } catch (e) {
    console.error(new Date().toISOString(), `${job} failed:`, e.message);
  }
}
async function tick() {
  await run("dispatch");
}
await tick();
setInterval(tick, 30_000);
