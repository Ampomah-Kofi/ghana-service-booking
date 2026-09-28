"use server";

import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/public-env";
import { serverEnv } from "@/server/env";
import { getPaymentProvider } from "@/server/payments";
import { MOCK_SIGNATURE_HEADER, MockPaymentProvider } from "@/server/payments/mock-payment-provider";
import { createUserClient } from "@/server/db/supabase-server";

/**
 * MOCK ONLY. Plays the customer's phone: approve or decline, then deliver the provider's signed
 * webhook to our own webhook route, exactly as a real provider would.
 */
export async function decideMockPaymentAction(formData: FormData): Promise<void> {
  const provider = getPaymentProvider();
  if (serverEnv().APP_ENV === "production" || !(provider instanceof MockPaymentProvider)) return;
  const reference = String(formData.get("reference") ?? "");
  const outcome = formData.get("outcome") === "paid" ? "paid" : "failed";
  const signed = provider.decide(reference, outcome);
  if (signed) {
    const site = publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    const res = await fetch(`${site}/api/internal/webhooks/payments/mock`, {
      method: "POST",
      headers: { "content-type": "application/json", [MOCK_SIGNATURE_HEADER]: signed.signature },
      body: signed.rawBody,
    });
    if (!res.ok) console.error("[mock-pay] webhook answered", res.status);
  }
  // The customer's own session can read their payment (RLS).
  const db = await createUserClient();
  const { data } = await db
    .from("payments")
    .select("appointment_id")
    .eq("provider", "mock")
    .eq("provider_reference", reference)
    .maybeSingle();
  redirect(data ? `/bookings/${data.appointment_id}?payment=${outcome}` : "/bookings");
}
