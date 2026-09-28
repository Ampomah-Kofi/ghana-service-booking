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
    // Appointments are never deleted by the app (business records); tests remove their own.
    await db.from("appointments").delete().eq("business_id", b.id);
    await db.from("businesses").delete().eq("id", b.id);
  }
  await db.auth.admin.deleteUser(user.id);
}

export type TestBusiness = { id: string; slug: string; name: string };

/** A minimal published solo business owned by `owner` (Phase 7 E2E: reviews need a business to reply as). */
export async function createPublishedBusiness(owner: TestUser, name: string): Promise<TestBusiness> {
  const db = admin();
  const slug = `e2e-${randomUUID().slice(0, 8)}`;
  const { data: business, error } = await db
    .from("businesses")
    .insert({
      slug,
      name,
      kind: "solo",
      status: "published",
      published_at: new Date().toISOString(),
      country_code: "GH",
      currency_code: "GHS",
      created_by: owner.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  await db.from("business_members").insert({ business_id: business.id, user_id: owner.id, role: "owner" });
  const { data: staff } = await db
    .from("staff")
    .insert({ business_id: business.id, user_id: owner.id, display_name: name.split(" ")[0] })
    .select("id")
    .single();
  const { data: service } = await db
    .from("services")
    .insert({
      business_id: business.id,
      name: "Silk press",
      price_minor: 15000,
      duration_minutes: 60,
      currency_code: "GHS",
    })
    .select("id")
    .single();
  if (!staff || !service) throw new Error("business setup failed");
  await db.from("staff_services").insert({ business_id: business.id, staff_id: staff.id, service_id: service.id });
  return { id: business.id, slug, name };
}

/** A visit that already happened and was completed (completing needs the visit to have started). */
export async function createCompletedVisit(business: TestBusiness, customer: TestUser): Promise<string> {
  const db = admin();
  const { data: staff } = await db.from("staff").select("id").eq("business_id", business.id).single();
  const { data: service } = await db.from("services").select("id").eq("business_id", business.id).single();
  if (!staff || !service) throw new Error("business not set up");
  const start = new Date(Date.now() - 2 * 86_400_000);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  const { data, error } = await db
    .from("appointments")
    .insert({
      business_id: business.id,
      service_id: service.id,
      staff_id: staff.id,
      source: "online",
      status: "completed",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      occupied: `[${start.toISOString()},${end.toISOString()})`, // recomputed by trigger
      service_name: "Silk press",
      price_minor: 15000,
      price_type: "fixed",
      currency_code: "GHS",
      customer_name: "E2E Customer",
      customer_user_id: customer.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
