import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Db } from "@/server/db/client";
import type { Database } from "@/server/db/types";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for integration tests (see .env.example)`);
  return value;
}

const url = () => {
  const value = env("NEXT_PUBLIC_SUPABASE_URL");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(value))
    throw new Error("integration tests only run against local Supabase");
  return value;
};

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const adminClient = () => createClient<Database>(url(), env("SUPABASE_SECRET_KEY"), noSession);
export const anonClient = (): Db =>
  createClient<Database>(url(), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), noSession);

export type SignedInUser = { id: string; db: Db };

/** A fresh user signed in with the publishable key, so RLS applies exactly as in the app. */
export async function signedInUser(fullName: string): Promise<SignedInUser> {
  const email = `it-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;
  const created = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (created.error || !created.data.user) throw created.error ?? new Error("createUser failed");
  const db = anonClient();
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: created.data.user.id, db };
}

export async function cleanup(userIds: string[]): Promise<void> {
  const admin = adminClient();
  for (const id of userIds) {
    const { data } = await admin.from("businesses").select("id").eq("created_by", id);
    for (const b of data ?? []) {
      for (const folder of ["photos", "logo"]) {
        const { data: files } = await admin.storage.from("public-media").list(`businesses/${b.id}/${folder}`);
        if (files?.length)
          await admin.storage.from("public-media").remove(files.map((f) => `businesses/${b.id}/${folder}/${f.name}`));
      }
      await admin.from("businesses").delete().eq("id", b.id);
    }
    await admin.auth.admin.deleteUser(id);
  }
}

/** Smallest byte sequences our sniffing accepts (Storage itself doesn't decode images). */
export const fakeJpeg = (name: string) =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])], name, { type: "image/jpeg" });
export const fakeWebp = (name: string) =>
  new File([new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ")], name, { type: "image/webp" });
