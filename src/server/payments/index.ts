import "server-only";
import { publicEnv } from "@/lib/public-env";
import { serverEnv } from "@/server/env";
import { MockPaymentProvider } from "./mock-payment-provider";
import type { PaymentProvider } from "./provider";

let instance: PaymentProvider | null | undefined;

/** The configured payment provider, or null when online payments are off (PAYMENTS_PROVIDER=none). */
export function getPaymentProvider(): PaymentProvider | null {
  if (instance !== undefined) return instance;
  const env = serverEnv();
  switch (env.PAYMENTS_PROVIDER) {
    case "mock":
      if (!env.PAYMENTS_WEBHOOK_SECRET) {
        throw new Error("PAYMENTS_WEBHOOK_SECRET is required for the mock payment provider");
      }
      instance = new MockPaymentProvider(env.PAYMENTS_WEBHOOK_SECRET, publicEnv().NEXT_PUBLIC_SITE_URL);
      return instance;
    case "none":
      instance = null;
      return instance;
  }
}

/** The provider by its id (webhooks name it in the URL). */
export function paymentProviderById(id: string): PaymentProvider | null {
  const p = getPaymentProvider();
  return p && p.id === id ? p : null;
}

export function onlinePaymentsEnabled(): boolean {
  return getPaymentProvider() !== null;
}
