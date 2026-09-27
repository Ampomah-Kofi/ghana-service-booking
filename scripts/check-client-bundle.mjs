// Fails if a server-only secret leaked into the browser bundle (CLAUDE.md: secrets are server-only).
// Run after `pnpm build`. Checks for the Supabase secret-key prefix and the actual secret values.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = ".next/static";
const needles = ["sb_secret_", "whsec_", process.env.SUPABASE_SECRET_KEY, process.env.SEND_SMS_HOOK_SECRET].filter(
  (v) => typeof v === "string" && v.length >= 8,
);

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

let leaks = 0;
for (const file of files(root)) {
  const content = readFileSync(file, "utf8");
  for (const needle of needles) {
    if (content.includes(needle)) {
      console.error(`LEAK: ${file} contains ${needle.slice(0, 10)}…`);
      leaks++;
    }
  }
}
if (leaks > 0) process.exit(1);
console.log(`check-client-bundle: no secrets found in ${root}`);
