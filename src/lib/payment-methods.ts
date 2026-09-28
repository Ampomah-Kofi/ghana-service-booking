/**
 * Ways a customer can pay a business directly (ADR-0017: no money moves through the app).
 * Labels are shared by the booking screens, the ticket, the business settings and receipts.
 */
export const PAYMENT_METHODS = {
  cash: { label: "Cash", short: "Cash", hint: "Pay at the visit" },
  mobile_money: { label: "Mobile Money", short: "MoMo", hint: "Send to the business's number" },
  bank_transfer: { label: "Bank transfer", short: "Bank", hint: "Send to the business's account" },
  card: { label: "Card at the shop", short: "Card", hint: "Pay by card at the visit" },
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export const PAYMENT_METHOD_KEYS = Object.keys(PAYMENT_METHODS) as [PaymentMethod, ...PaymentMethod[]];

export const MOMO_NETWORKS = { mtn: "MTN MoMo", telecel: "Telecel Cash", airteltigo: "AirtelTigo Money" } as const;
export type MomoNetwork = keyof typeof MOMO_NETWORKS;

/** "Pays: Cash · MoMo" in the order the app lists them. */
export function acceptedSummary(methods: readonly PaymentMethod[]): string {
  return PAYMENT_METHOD_KEYS.filter((m) => methods.includes(m))
    .map((m) => PAYMENT_METHODS[m].short)
    .join(" · ");
}

/** A short code the customer puts on a transfer so the business can match it: "BK-3C9AC9". */
export function paymentReference(appointmentId: string): string {
  return `BK-${appointmentId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
