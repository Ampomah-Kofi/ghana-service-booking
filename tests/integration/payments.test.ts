import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createService } from "@/server/businesses/catalog";
import { createBusiness } from "@/server/businesses/onboarding";
import { listStaff } from "@/server/businesses/team";
import { listActiveCategories } from "@/server/catalog/categories";
import { handlePaymentWebhook, runPaymentJobs } from "@/server/jobs/payments";
import { getPaymentProvider } from "@/server/payments";
import { MOCK_SIGNATURE_HEADER, MockPaymentProvider } from "@/server/payments/mock-payment-provider";
import { listAppointmentPayments, recordManualPayment, startPayment } from "@/server/payments/service";
import { getPayoutAccount, savePaymentRules, setPayoutAccount } from "@/server/payments/settings";
import { adminClient, cleanup, signedInUser, type SignedInUser } from "./support";

/**
 * Phase 9 end to end on the server: a deposit booking is paid through the mock provider, the signed
 * webhook confirms it exactly once, the job releases expired holds, sends refunds and catches lost
 * webhooks. Uses the real services and routes' handlers against local Supabase.
 */
let owner: SignedInUser;
let customer: SignedInUser;
let stranger: SignedInUser;
const cleanupIds: string[] = [];
let businessId: string;
let serviceId: string;
let staffId: string;
let day = 3;

const mock = () => {
  const p = getPaymentProvider();
  if (!(p instanceof MockPaymentProvider)) throw new Error("tests expect PAYMENTS_PROVIDER=mock");
  return p;
};

/** A deposit booking waiting to be paid (inserted like book_appointment does). */
async function heldBooking(holdMinutes = 15): Promise<string> {
  const start = new Date(Date.now() + day++ * 86_400_000);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  const { data, error } = await adminClient()
    .from("appointments")
    .insert({
      business_id: businessId,
      service_id: serviceId,
      staff_id: staffId,
      source: "online",
      status: "pending",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      occupied: `[${start.toISOString()},${end.toISOString()})`,
      service_name: "Silk press",
      price_minor: 12000,
      price_type: "fixed",
      currency_code: "GHS",
      deposit_minor: 3000,
      payment_status: "pending",
      hold_expires_at: new Date(Date.now() + holdMinutes * 60_000).toISOString(),
      customer_name: "Akosua Mensah",
      customer_phone_e164: "+233244555777",
      customer_user_id: customer.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const pay = (appointmentId: string, db = customer.db) =>
  startPayment(db, {
    appointmentId,
    kind: "deposit",
    method: "mobile_money",
    phoneE164: "+233244555777",
    network: "mtn",
    customerName: "Akosua Mensah",
    description: "Deposit for Silk press",
    returnUrl: `http://localhost:3000/bookings/${appointmentId}`,
  });

async function appointment(id: string) {
  const { data } = await adminClient()
    .from("appointments")
    .select("status, hold_expires_at, payment_status, cancellation_reason")
    .eq("id", id)
    .single();
  return data!;
}

beforeAll(async () => {
  owner = await signedInUser("Payments Owner");
  customer = await signedInUser("Akosua Mensah");
  stranger = await signedInUser("Nosy Stranger");
  cleanupIds.push(owner.id, customer.id, stranger.id);
  const [cat] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "hair-salons");
  businessId = (await createBusiness(owner.db, { kind: "solo", name: "Silk Studio", categoryId: cat.id }, "GH")).id;
  [{ id: staffId }] = await listStaff(owner.db, businessId, { withInvites: false });
  serviceId = await createService(
    owner.db,
    { id: businessId, currencyCode: "GHS" },
    {
      name: "Silk press",
      description: null,
      price: 120,
      priceType: "fixed",
      durationMinutes: 60,
      deposit: 30,
      isActive: true,
      staffIds: [staffId],
    },
  );
  const admin = adminClient();
  await admin
    .from("businesses")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", businessId);
  // Where the money goes, then switch deposits on (the database refuses the other order).
  const { error: payoutError } = await owner.db.rpc("set_payout_account", {
    p_business_id: businessId,
    p_method: "mobile_money",
    p_account_name: "Silk Studio",
    p_momo_network: "mtn",
    p_momo_number: "+233244555000",
  });
  if (payoutError) throw payoutError;
  const { error: rulesError } = await owner.db
    .from("booking_rules")
    .update({ collect_deposits_online: true })
    .eq("business_id", businessId);
  if (rulesError) throw rulesError;
}, 60_000);

afterAll(async () => {
  const admin = adminClient();
  await admin.from("notifications").delete().eq("business_id", businessId);
  const { data: pays } = await admin.from("payments").select("id").eq("business_id", businessId);
  const ids = (pays ?? []).map((p) => p.id);
  if (ids.length) await admin.from("payment_events").delete().in("payment_id", ids);
  await admin.from("payments").delete().eq("business_id", businessId);
  await cleanup(cleanupIds);
});

describe("payments", () => {
  it("pays a deposit through the mock provider and confirms the booking from the signed webhook", async () => {
    const id = await heldBooking();
    const started = await pay(id);
    expect(started.amountMinor).toBe(3000);
    expect(started.next.type).toBe("await_customer_approval");

    const [attempt] = await listAppointmentPayments(customer.db, id);
    expect(attempt.status).toBe("pending");
    const { data: row } = await adminClient()
      .from("payments")
      .select("provider_reference")
      .eq("id", attempt.id)
      .single();
    const signed = mock().decide(row!.provider_reference!, "paid")!;

    const headers = new Headers({ [MOCK_SIGNATURE_HEADER]: signed.signature });
    expect(await handlePaymentWebhook("mock", headers, signed.rawBody)).toEqual({
      status: 200,
      body: { result: "applied" },
    });
    expect(await appointment(id)).toMatchObject({
      status: "confirmed",
      hold_expires_at: null,
      payment_status: "partially_paid",
    });

    // The same delivery again changes nothing; a forged or unknown sender is refused.
    expect((await handlePaymentWebhook("mock", headers, signed.rawBody)).body).toEqual({ result: "duplicate" });
    expect(
      (await handlePaymentWebhook("mock", new Headers({ [MOCK_SIGNATURE_HEADER]: "0".repeat(64) }), signed.rawBody))
        .status,
    ).toBe(401);
    expect((await handlePaymentWebhook("someone-else", headers, signed.rawBody)).status).toBe(404);
  });

  it("only the person who booked can pay, and staff/other people see no money", async () => {
    const id = await heldBooking();
    await expect(pay(id, stranger.db)).rejects.toThrow(/not found/i);
    expect(await listAppointmentPayments(stranger.db, id)).toEqual([]);
  });

  it("the job releases an expired hold, then refunds a cancelled paid deposit", async () => {
    const expired = await heldBooking(-1);
    const r1 = await runPaymentJobs();
    expect(r1.holdsReleased).toBeGreaterThanOrEqual(1);
    expect(await appointment(expired)).toMatchObject({
      status: "cancelled",
      cancellation_reason: "Payment not completed in time",
    });

    // Pay a fresh booking, then the customer cancels in time → refund queued → the job sends it.
    const id = await heldBooking();
    await pay(id);
    const [attempt] = await listAppointmentPayments(customer.db, id);
    const { data: row } = await adminClient()
      .from("payments")
      .select("provider_reference")
      .eq("id", attempt.id)
      .single();
    const signed = mock().decide(row!.provider_reference!, "paid")!;
    await handlePaymentWebhook("mock", new Headers({ [MOCK_SIGNATURE_HEADER]: signed.signature }), signed.rawBody);
    const { error } = await customer.db.rpc("cancel_my_appointment", { p_appointment_id: id, p_reason: "Travelling" });
    expect(error).toBeNull();
    expect((await listAppointmentPayments(customer.db, id))[0].status).toBe("refund_pending");

    const r2 = await runPaymentJobs();
    expect(r2.refunded).toBeGreaterThanOrEqual(1);
    expect((await listAppointmentPayments(customer.db, id))[0].status).toBe("refunded");
    expect((await appointment(id)).payment_status).toBe("refunded");
  });

  it("shows the owner a masked payout account, hides it from others, and needs one before online payments", async () => {
    expect(await getPayoutAccount(owner.db, businessId)).toMatchObject({
      method: "mobile_money",
      network: "mtn",
      last4: "5000",
      status: "unverified",
    });
    expect(await getPayoutAccount(stranger.db, businessId)).toBeNull();
    await expect(
      setPayoutAccount(stranger.db, businessId, {
        method: "bank",
        accountName: "Thief",
        bankName: "Any Bank",
        accountNumber: "12345678",
      }),
    ).rejects.toThrow();

    // A second business with no payout details can't switch online payments on.
    const [cat] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "hair-salons");
    const second = (await createBusiness(owner.db, { kind: "solo", name: "Second Studio", categoryId: cat.id }, "GH"))
      .id;
    const rules = { collectDepositsOnline: true, allowFullPaymentOnline: false, refundDepositOnNoShow: false };
    await expect(savePaymentRules(owner.db, second, rules)).rejects.toThrow(/where you get paid/i);
    await setPayoutAccount(owner.db, second, {
      method: "bank",
      accountName: "Second Studio",
      bankName: "GCB Bank",
      accountNumber: "1234 5678 9012",
    });
    await expect(savePaymentRules(owner.db, second, rules)).resolves.toBeUndefined();
    expect(await getPayoutAccount(owner.db, second)).toMatchObject({ method: "bank", last4: "9012" });
    await expect(savePaymentRules(stranger.db, second, rules)).rejects.toThrow();
  });

  it("the business records cash at the visit, capped at the price", async () => {
    const id = await heldBooking();
    await adminClient().from("appointments").update({ status: "confirmed", hold_expires_at: null }).eq("id", id);
    await recordManualPayment(owner.db, id, 12000, "cash", null);
    expect((await appointment(id)).payment_status).toBe("paid");
    await expect(recordManualPayment(owner.db, id, 100, "cash", null)).rejects.toThrow(/more than the price/i);
    await expect(recordManualPayment(stranger.db, id, 100, "cash", null)).rejects.toThrow();
  });

  it("catches a lost webhook by asking the provider (reconciliation)", async () => {
    const id = await heldBooking();
    await pay(id);
    const [attempt] = await listAppointmentPayments(customer.db, id);
    const admin = adminClient();
    const { data: row } = await admin.from("payments").select("provider_reference").eq("id", attempt.id).single();
    mock().decide(row!.provider_reference!, "paid"); // approved on the phone, but the webhook never arrives
    await admin
      .from("payments")
      .update({ created_at: new Date(Date.now() - 11 * 60_000).toISOString() })
      .eq("id", attempt.id);

    const r = await runPaymentJobs();
    expect(r.reconciled).toBeGreaterThanOrEqual(1);
    expect((await appointment(id)).status).toBe("confirmed");
  });
});
