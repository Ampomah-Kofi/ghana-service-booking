import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/server/db/types";

/**
 * Test-only admin helpers (secret key; local Supabase only). Each test gets a
 * brand-new email/password user so runs never collide, and cleans up after itself.
 */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example)");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url))
    throw new Error("E2E admin helpers refuse to run against a non-local Supabase");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type TestUser = { id: string; email: string; password: string };

export async function createTestUser(fullName: string): Promise<TestUser> {
  const email = `e2e-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { id: data.user.id, email, password };
}

export async function deleteTestUser(user: TestUser): Promise<void> {
  const db = admin();
  const { data: businesses } = await db.from("businesses").select("id").eq("created_by", user.id);
  for (const b of businesses ?? []) {
    const { data: files } = await db.storage.from("public-media").list(`businesses/${b.id}/photos`);
    const { data: logos } = await db.storage.from("public-media").list(`businesses/${b.id}/logo`);
    const paths = [
      ...(files ?? []).map((f) => `businesses/${b.id}/photos/${f.name}`),
      ...(logos ?? []).map((f) => `businesses/${b.id}/logo/${f.name}`),
    ];
    if (paths.length) await db.storage.from("public-media").remove(paths);
    await db.from("businesses").delete().eq("id", b.id);
  }
  await db.auth.admin.deleteUser(user.id);
}
