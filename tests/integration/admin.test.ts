import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getBusiness,
  getPlatformStats,
  getUser,
  listAudit,
  listBusinesses,
  listUsers,
  setBusinessSuspended,
  setUserSuspended,
} from "@/server/admin/admin";
import { bookAppointment } from "@/server/bookings/appointments";
import { createService } from "@/server/businesses/catalog";
import { getInsights } from "@/server/businesses/insights";
import { createBusiness } from "@/server/businesses/onboarding";
import { getBusinessById } from "@/server/businesses/queries";
import { listStaff } from "@/server/businesses/team";
import { listActiveCategories } from "@/server/catalog/categories";
import { adminClient, anonClient, cleanup, signedInUser, type SignedInUser } from "./support";

/**
 * Phase 10 on the server: admins find and suspend businesses and people through the real services
 * (audited, role-checked in the database), suspension stops a customer booking with a clear message,
 * and insights stay private to the business's owners and managers.
 */
let moderator: SignedInUser;
let support: SignedInUser;
let owner: SignedInUser;
let customer: SignedInUser;
const ids: string[] = [];
let businessId: string;
let slug: string;
let serviceId: string;

beforeAll(async () => {
  moderator = await signedInUser("Mo Moderator");
  support = await signedInUser("Sam Support");
  owner = await signedInUser("Abena Owner");
  customer = await signedInUser("Kofi Customer");
  ids.push(moderator.id, support.id, owner.id, customer.id);
  const admin = adminClient();
  await admin.from("platform_admins").insert([
    { user_id: moderator.id, role: "moderator" },
    { user_id: support.id, role: "support" },
  ]);
  const [cat] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "hair-salons");
  const created = await createBusiness(owner.db, { kind: "solo", name: "Abena Hair Loft", categoryId: cat.id }, "GH");
  businessId = created.id;
  const [{ id: staffId }] = await listStaff(owner.db, businessId, { withInvites: false });
  serviceId = await createService(
    owner.db,
    { id: businessId, currencyCode: "GHS" },
    {
      name: "Cornrows",
      description: null,
      price: 8000,
      priceType: "fixed",
      durationMinutes: 60,
      isActive: true,
      staffIds: [staffId],
    },
  );
  const { data: biz } = await admin
    .from("businesses")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", businessId)
    .select("slug")
    .single();
  slug = biz!.slug;
  await admin.from("business_hours").delete().eq("business_id", businessId);
  await admin
    .from("business_hours")
    .insert([1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ business_id: businessId, weekday, during: "[06:00,22:00)" })));
  await admin.from("booking_rules").update({ min_notice_minutes: 0 }).eq("business_id", businessId);
}, 60_000);

afterAll(async () => {
  const admin = adminClient();
  // The audit log is append-only for people; tests remove their own rows so the users can be deleted.
  await admin.from("admin_actions").delete().in("admin_user_id", [moderator.id, support.id]);
  await admin.from("platform_admins").delete().in("user_id", [moderator.id, support.id]);
  await admin.from("notifications").delete().eq("business_id", businessId);
  await cleanup(ids);
});

async function book(): Promise<string> {
  const business = (await getBusinessById(customer.db, businessId))!;
  const start = new Date(Date.now() + 3 * 86_400_000);
  start.setUTCHours(11, 0, 0, 0);
  return bookAppointment(customer.db, business, {
    businessId,
    serviceId,
    staffId: null,
    startsAt: start,
    customerName: "Kofi Customer",
    customerPhone: "+233244000321",
    note: null,
    idempotencyKey: crypto.randomUUID(),
  });
}

describe("admin", () => {
  it("any admin sees stats and finds businesses and people; others are refused", async () => {
    const stats = await getPlatformStats(support.db);
    expect(stats.users).toBeGreaterThanOrEqual(4);
    expect((await listBusinesses(support.db, "Abena Hair", null)).map((b) => b.id)).toEqual([businessId]);
    expect((await getBusiness(support.db, businessId))?.owners[0]?.name).toBe("Abena Owner");
    expect((await listUsers(support.db, "Kofi Customer")).map((u) => u.id)).toContain(customer.id);
    expect((await getUser(support.db, customer.id))?.full_name).toBe("Kofi Customer");
    await expect(getPlatformStats(owner.db)).rejects.toThrow();
    await expect(listUsers(customer.db, null)).rejects.toThrow();
  });

  it("a moderator suspends and restores a business; support can't; it's audited and hidden meanwhile", async () => {
    await expect(setBusinessSuspended(support.db, businessId, true, "Spam")).rejects.toThrow();
    expect(await setBusinessSuspended(moderator.db, businessId, true, "Fake photos reported")).toBe("suspended");
    expect(await getBusinessById(anonClient(), businessId)).toBeNull();
    expect(await setBusinessSuspended(moderator.db, businessId, false, "Real photos sent")).toBe("published");
    expect(await getBusinessById(anonClient(), businessId)).not.toBeNull();
    const log = await listAudit(moderator.db, { targetId: businessId });
    expect(log.map((e) => e.action)).toEqual(["business.restore", "business.suspend"]);
    expect(log[0]).toMatchObject({ adminName: "Mo Moderator", reason: "Real photos sent" });
    expect(slug).toBeTruthy();
  });

  it("a suspended customer is told why they can't book, and can again once restored", async () => {
    await setUserSuspended(moderator.db, customer.id, true, "Repeated no-shows and abuse");
    await expect(book()).rejects.toThrow(/your account is suspended/i);
    await setUserSuspended(moderator.db, customer.id, false, "Appeal accepted");
    await expect(book()).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("insights", () => {
  it("counts the business's bookings for its owner, and nobody else can read them", async () => {
    const admin = adminClient();
    const { data: staff } = await admin.from("staff").select("id").eq("business_id", businessId).single();
    const t = new Date(Date.now() - 2 * 86_400_000);
    await admin.from("appointments").insert({
      business_id: businessId,
      service_id: serviceId,
      staff_id: staff!.id,
      source: "walk_in",
      status: "completed",
      starts_at: t.toISOString(),
      ends_at: new Date(t.getTime() + 3_600_000).toISOString(),
      occupied: `[${t.toISOString()},${new Date(t.getTime() + 3_600_000).toISOString()})`,
      service_name: "Cornrows",
      price_minor: 8000,
      price_type: "fixed",
      currency_code: "GHS",
      customer_name: "Walk-in",
    });
    const s = await getInsights(owner.db, businessId, 7);
    expect(s).toMatchObject({ completed: 1, completed_value_minor: 8000, days: 7 });
    expect(s.per_day).toHaveLength(7);
    expect(s.top_services[0]).toMatchObject({ name: "Cornrows", count: 1 });
    await expect(getInsights(customer.db, businessId, 7)).rejects.toThrow(/not found/i);
    await expect(getInsights(moderator.db, businessId, 7)).rejects.toThrow(/not found/i);
  });
});
