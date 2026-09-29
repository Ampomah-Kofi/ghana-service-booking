import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookAppointment, getAppointment } from "@/server/bookings/appointments";
import { createService } from "@/server/businesses/catalog";
import { createBusiness } from "@/server/businesses/onboarding";
import { getBusinessById } from "@/server/businesses/queries";
import { listStaff } from "@/server/businesses/team";
import { listActiveCategories } from "@/server/catalog/categories";
import {
  choosePaymentMethod,
  getBookingPaymentDetails,
  listAppointmentPayments,
  listBusinessPayments,
  markPaymentRefunded,
  recordPayment,
} from "@/server/payments/service";
import { getPaymentDetails, saveAcceptedMethods, setPaymentDetails } from "@/server/payments/settings";
import { adminClient, cleanup, signedInUser, type SignedInUser } from "./support";

/**
 * ADR-0017 on the server: no money moves through the app. The business lists how it takes payment
 * and its own MoMo / bank details; the customer books saying how they'll pay and sees those details
 * on their own booking only; the business marks it paid (and refunded). Real services, local Supabase.
 */
let owner: SignedInUser;
let customer: SignedInUser;
let stranger: SignedInUser;
const cleanupIds: string[] = [];
let businessId: string;
let serviceId: string;
let day = 3;

async function book(paymentMethod: "cash" | "mobile_money" | "bank_transfer" | "card" | null = null) {
  const business = (await getBusinessById(customer.db, businessId))!;
  const start = new Date(Date.now() + day++ * 86_400_000);
  start.setUTCHours(10, 0, 0, 0);
  return bookAppointment(customer.db, business, {
    businessId,
    serviceId,
    staffId: null,
    startsAt: start,
    customerName: "Akosua Mensah",
    customerPhone: "+233244555777",
    note: null,
    idempotencyKey: crypto.randomUUID(),
    paymentMethod,
  });
}

beforeAll(async () => {
  owner = await signedInUser("Payments Owner");
  customer = await signedInUser("Akosua Mensah");
  stranger = await signedInUser("Nosy Stranger");
  cleanupIds.push(owner.id, customer.id, stranger.id);
  const [cat] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "hair-salons");
  businessId = (await createBusiness(owner.db, { kind: "solo", name: "Silk Studio", categoryId: cat.id }, "GH")).id;
  const [{ id: staffId }] = await listStaff(owner.db, businessId, { withInvites: false });
  serviceId = await createService(
    owner.db,
    { id: businessId, currencyCode: "GHS" },
    {
      name: "Silk press",
      description: null,
      price: 12000,
      priceType: "fixed",
      durationMinutes: 60,
      isActive: true,
      staffIds: [staffId],
    },
  );
  const admin = adminClient();
  await admin
    .from("businesses")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", businessId);
  // Open every day 06:00–22:00 with no minimum notice, so any test day is bookable.
  await admin.from("business_hours").delete().eq("business_id", businessId);
  await admin
    .from("business_hours")
    .insert([1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ business_id: businessId, weekday, during: "[06:00,22:00)" })));
  await admin.from("booking_rules").update({ min_notice_minutes: 0 }).eq("business_id", businessId);
}, 60_000);

afterAll(async () => {
  const admin = adminClient();
  await admin.from("notifications").delete().eq("business_id", businessId);
  await admin.from("payments").delete().eq("business_id", businessId);
  await cleanup(cleanupIds);
});

describe("direct payments (no money through the app)", () => {
  it("the owner sets accepted methods and MoMo details; strangers can do neither", async () => {
    await saveAcceptedMethods(owner.db, businessId, ["cash", "mobile_money"]);
    await expect(saveAcceptedMethods(stranger.db, businessId, ["card"])).rejects.toThrow();
    await setPaymentDetails(owner.db, businessId, {
      momo: { network: "mtn", phone: "+233244555000", name: "Silk Studio" },
      bank: null,
    });
    await expect(
      setPaymentDetails(stranger.db, businessId, {
        momo: { network: "mtn", phone: "+233240000999", name: "Thief" },
        bank: null,
      }),
    ).rejects.toThrow();
    expect(await getPaymentDetails(owner.db, businessId)).toMatchObject({ momoNumber: "+233244555000" });
    expect(await getPaymentDetails(stranger.db, businessId)).toBeNull();
  });

  it("a booking records how the customer will pay and shows them the business's number", async () => {
    const id = await book("mobile_money");
    const booked = await getAppointment(customer.db, id);
    expect(booked).toMatchObject({ status: "confirmed", paymentMethodChoice: "mobile_money", paymentStatus: null });
    expect(await getBookingPaymentDetails(customer.db, id)).toEqual({
      momo: { network: "mtn", number: "+233244555000", name: "Silk Studio" },
      bank: null,
    });
    expect(await getBookingPaymentDetails(stranger.db, id)).toBeNull();
    // A method the business doesn't take is refused.
    await expect(choosePaymentMethod(customer.db, id, "card")).rejects.toThrow(/doesn.t take/i);
    await choosePaymentMethod(customer.db, id, "cash");
    expect((await getAppointment(customer.db, id))?.paymentMethodChoice).toBe("cash");
  });

  it("the business marks it paid, capped at the price; refunds are recorded; strangers see nothing", async () => {
    const id = await book("mobile_money");
    await expect(recordPayment(customer.db, id, 1000, "cash", null)).rejects.toThrow();
    await expect(recordPayment(stranger.db, id, 1000, "cash", null)).rejects.toThrow();
    const first = await recordPayment(owner.db, id, 5000, "mobile_money", "MoMo txn 998");
    await expect(recordPayment(owner.db, id, 8000, "cash", null)).rejects.toThrow(/more than the price/i);
    await recordPayment(owner.db, id, 7000, "cash", null);
    expect((await getAppointment(owner.db, id))?.paymentStatus).toBe("paid");
    expect(await listAppointmentPayments(customer.db, id)).toHaveLength(2);
    expect(await listAppointmentPayments(stranger.db, id)).toEqual([]);

    const since = new Date(Date.now() - 60_000);
    expect((await listBusinessPayments(owner.db, businessId, since)).map((p) => p.amountMinor).sort()).toEqual([
      5000, 7000,
    ]);

    await markPaymentRefunded(owner.db, first, "Sent back, service changed");
    expect((await getAppointment(owner.db, id))?.paymentStatus).toBe("partially_paid");
    await expect(markPaymentRefunded(owner.db, first, "Again")).rejects.toThrow(/already/i);

    // The customer gets an in-app receipt each time, and no text message about money.
    const { data: notes } = await adminClient()
      .from("notifications")
      .select("channel")
      .eq("appointment_id", id)
      .eq("template_key", "payment.received");
    expect(notes?.map((n) => n.channel)).toEqual(["in_app", "in_app"]);
  });
});
