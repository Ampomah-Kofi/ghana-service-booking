import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createService } from "@/server/businesses/catalog";
import { createBusiness } from "@/server/businesses/onboarding";
import { listStaff } from "@/server/businesses/team";
import { listActiveCategories } from "@/server/catalog/categories";
import { dispatchDueNotifications } from "@/server/jobs/dispatch";
import {
  getMessagePreferences,
  listMyNotifications,
  markRead,
  setMessagePreferences,
  unreadCount,
} from "@/server/notifications/inbox";
import { adminClient, cleanup, signedInUser, type SignedInUser } from "./support";

let owner: SignedInUser;
let customer: SignedInUser;
let stranger: SignedInUser;
const cleanupIds: string[] = [];
let businessId: string;
let serviceId: string;
let staffId: string;
let appointmentId: string;

beforeAll(async () => {
  owner = await signedInUser("Alert Owner");
  customer = await signedInUser("Efua Customer");
  stranger = await signedInUser("Nosy Stranger");
  cleanupIds.push(owner.id, customer.id, stranger.id);
  const [cat] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "electricians");
  businessId = (await createBusiness(owner.db, { kind: "solo", name: "Volt Electricals", categoryId: cat.id }, "GH"))
    .id;
  [{ id: staffId }] = await listStaff(owner.db, businessId, { withInvites: false });
  serviceId = await createService(
    owner.db,
    { id: businessId, currencyCode: "GHS" },
    {
      name: "Socket repair",
      description: null,
      price: 0,
      priceType: "on_request",
      durationMinutes: 60,
      deposit: null,
      isActive: true,
      staffIds: [staffId],
    },
  );
  const admin = adminClient();
  await admin
    .from("businesses")
    .update({ status: "published", published_at: new Date().toISOString(), phone_e164: "+233244777000" })
    .eq("id", businessId);

  // An online booking three days out (inserted directly: the trigger fires the same as for book_appointment).
  const start = new Date(Date.now() + 3 * 86_400_000);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  const { data, error } = await admin
    .from("appointments")
    .insert({
      business_id: businessId,
      service_id: serviceId,
      staff_id: staffId,
      source: "online",
      status: "confirmed",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      occupied: `[${start.toISOString()},${end.toISOString()})`,
      service_name: "Socket repair",
      price_minor: 0,
      price_type: "on_request",
      currency_code: "GHS",
      customer_name: "Efua Customer",
      customer_phone_e164: "+233244555666",
      customer_user_id: customer.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  appointmentId = data.id;
}, 60_000);

afterAll(async () => {
  await adminClient().from("notifications").delete().eq("business_id", businessId);
  await cleanup(cleanupIds);
});

describe("notifications", () => {
  it("puts the confirmation in the customer's inbox, and the alert in the owner's", async () => {
    const mine = await listMyNotifications(customer.db);
    expect(mine.map((n) => [n.template, n.title, n.href])).toEqual([
      ["booking.confirmed", "You're booked", `/bookings/${appointmentId}`],
    ]);
    expect(mine[0].body).toMatch(/^Socket repair with Alert Owner at Volt Electricals, /);
    const owners = await listMyNotifications(owner.db);
    expect(owners.map((n) => [n.template, n.audience])).toEqual([["provider.new_booking", "business"]]);
    expect(await listMyNotifications(stranger.db)).toEqual([]);
  });

  it("counts unread and marks read", async () => {
    expect(await unreadCount(customer.db)).toBe(1);
    await markRead(customer.db);
    expect(await unreadCount(customer.db)).toBe(0);
    expect(await unreadCount(owner.db)).toBe(1); // someone else's read state is untouched
  });

  it("stores one text channel per person", async () => {
    expect(await getMessagePreferences(customer.db, customer.id)).toEqual({ text: "sms", email: true });
    await setMessagePreferences(customer.db, customer.id, { text: "whatsapp", email: false });
    expect(await getMessagePreferences(customer.db, customer.id)).toEqual({ text: "whatsapp", email: false });
  });

  it("dispatches due texts through the mock providers and records the result", async () => {
    const result = await dispatchDueNotifications(200);
    expect(result.claimed).toBeGreaterThanOrEqual(2);
    expect(result.failed).toBe(0);
    const { data } = await adminClient()
      .from("notifications")
      .select("channel, recipient_address, status, provider, template_key")
      .eq("appointment_id", appointmentId)
      .neq("channel", "in_app")
      .lte("scheduled_for", new Date().toISOString())
      .order("template_key")
      .order("channel");
    expect(data).toEqual([
      {
        channel: "sms",
        recipient_address: "+233244555666",
        status: "sent",
        provider: "mock-sms",
        template_key: "booking.confirmed",
      },
      // Channel order follows the enum (sms, whatsapp, email). The customer allowed email when they
      // booked (they turned it off later), so the confirmation went by email too.
      {
        channel: "email",
        recipient_address: expect.stringMatching(/@example\.test$/),
        status: "sent",
        provider: "mock-email",
        template_key: "booking.confirmed",
      },
      {
        channel: "sms",
        recipient_address: "+233244777000",
        status: "sent",
        provider: "mock-sms",
        template_key: "provider.new_booking",
      },
    ]);
  });

  it("keeps reminders waiting until their time", async () => {
    const { data } = await adminClient()
      .from("notifications")
      .select("template_key, status")
      .eq("appointment_id", appointmentId)
      .like("template_key", "reminder.%")
      .eq("channel", "sms");
    expect(data?.map((r) => r.status).sort()).toEqual(["queued", "queued"]);
  });
});
