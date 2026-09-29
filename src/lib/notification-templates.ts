/**
 * Every message the platform sends (Phase 8, ADR-0013), rendered from the snapshot the database
 * stored with the notification. Pure: used by the dispatcher (texts, email) and the inbox (in-app).
 *
 * SMS rules: GSM-7 only (one "₵" or curly quote turns a text into UCS-2 and cuts it to 70 characters),
 * at most 160 characters, times in the business's timezone.
 */
import { BRAND } from "./brand";
import { formatDateShort, formatTime } from "./datetime";
import { formatMoney } from "./money";

export type NotificationPayload = {
  appointment_id?: string;
  business_id?: string;
  business_name?: string;
  business_slug?: string;
  business_phone?: string | null;
  timezone?: string;
  service_name?: string;
  staff_name?: string | null;
  starts_at?: string;
  ends_at?: string;
  customer_name?: string;
  /** Payment messages: the amount in minor units and its ISO 4217 code. */
  amount_minor?: number;
  currency?: string;
};

export type Rendered = {
  /** In-app inbox. */
  title: string;
  body: string;
  /** Where tapping the message goes. */
  href: string;
  /** SMS / WhatsApp text (GSM-7, ≤ 160). */
  text: string;
  email: { subject: string; text: string };
  /** Who the message is for: drives the icon and the link. */
  audience: "customer" | "business";
};

export const TEMPLATE_KEYS = [
  "booking.confirmed",
  "booking.requested",
  "booking.moved",
  "booking.cancelled",
  "reminder.day_before",
  "reminder.soon",
  "review.request",
  "provider.new_booking",
  "provider.needs_confirmation",
  "provider.cancelled_by_customer",
  "provider.moved_by_customer",
  "provider.upcoming",
  "payment.received",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

// GSM 03.38 basic set (plus the characters that cost two slots, which we avoid).
const GSM7 = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà]*$/;

/** Make text safe for one GSM-7 SMS: "GH₵" → "GHS", smart quotes and dashes → plain, anything else dropped. */
export function toGsm7(input: string): string {
  const replaced = input
    .replace(/GH₵\s?/g, "GHS ")
    .replace(/₵/g, "GHS")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return [...replaced].filter((ch) => GSM7.test(ch)).join("");
}

/** "GH₵ 20" from minor units + ISO code; the symbol and decimals come from Intl, not a hard-coded table. */
export function formatPaymentAmount(amountMinor: number | undefined, currency: string | undefined): string {
  if (amountMinor === undefined || !currency) return "your payment";
  try {
    const f = new Intl.NumberFormat("en-GH", { style: "currency", currency, currencyDisplay: "narrowSymbol" });
    const symbol = f.formatToParts(0).find((part) => part.type === "currency")?.value;
    const minorUnit = f.resolvedOptions().maximumFractionDigits ?? 2;
    return formatMoney({ amountMinor, currency }, { code: currency, minorUnit, symbol });
  } catch {
    return `${currency} ${amountMinor}`;
  }
}

/** Shorten the middle piece so the whole SMS fits 160 characters. */
function fit(prefix: string, variable: string, suffix: string, max = 160): string {
  const room = max - prefix.length - suffix.length;
  const v = variable.length > room ? `${variable.slice(0, Math.max(0, room - 3))}...` : variable;
  return toGsm7(`${prefix}${v}${suffix}`).slice(0, max);
}

export function renderNotification(key: string, p: NotificationPayload, siteUrl: string): Rendered {
  const tz = p.timezone ?? "UTC";
  const when = p.starts_at ? `${formatDateShort(p.starts_at, tz)}, ${formatTime(p.starts_at, tz)}` : "";
  const time = p.starts_at ? formatTime(p.starts_at, tz) : "";
  const service = p.service_name ?? "your booking";
  const biz = p.business_name ?? "the business";
  const withWhom = p.staff_name ? ` with ${p.staff_name}` : "";
  const customerHref = `/bookings/${p.appointment_id ?? ""}`;
  const businessHref = `/dashboard/${p.business_id ?? ""}/appointments/${p.appointment_id ?? ""}`;
  const site = siteUrl.replace(/\/$/, "");
  const link = `${site}${customerHref}`;
  const sign = `${BRAND.name}: `;
  const amount = formatPaymentAmount(p.amount_minor, p.currency);

  const customer = (
    title: string,
    body: string,
    sms: [string, string, string],
    subject: string,
    href = customerHref,
  ): Rendered => ({
    title,
    body,
    href,
    text: fit(sign + sms[0], sms[1], sms[2]),
    email: { subject: `${subject} · ${biz}`, text: `${body}\n\nSee your booking: ${link}\n\n${BRAND.name}` },
    audience: "customer",
  });
  const business = (title: string, body: string, sms: [string, string, string]): Rendered => ({
    title,
    body,
    href: businessHref,
    text: fit(sign + sms[0], sms[1], sms[2]),
    email: { subject: title, text: body },
    audience: "business",
  });

  switch (key as TemplateKey) {
    case "booking.confirmed":
      return customer(
        "You're booked",
        `${service}${withWhom} at ${biz}, ${when}.`,
        ["Booked! ", `${service} at ${biz}`, `, ${when}. Details: ${link}`],
        "You're booked",
      );
    case "booking.requested":
      return customer(
        "Request sent",
        `${biz} will confirm ${service}, ${when}. We'll let you know.`,
        ["Request sent to ", biz, ` for ${when}. We'll text you when it's confirmed.`],
        "Request sent",
      );
    case "booking.moved":
      return customer(
        "Booking moved",
        `${service} at ${biz} is now ${when}.`,
        ["Moved: ", `${service} at ${biz}`, ` is now ${when}. Details: ${link}`],
        "Your booking has moved",
      );
    case "booking.cancelled":
      return customer(
        "Booking cancelled",
        `${biz} cancelled ${service}, ${when}. Sorry about that. You can book another time.`,
        ["", `${biz} cancelled ${service}`, `, ${when}. Book another time: ${site}/business/${p.business_slug ?? ""}`],
        "Booking cancelled",
      );
    case "reminder.day_before":
      return customer(
        "Tomorrow",
        `${service}${withWhom} at ${biz}, ${when}.`,
        ["Reminder: ", `${service} at ${biz}`, ` tomorrow at ${time}. Details: ${link}`],
        "Reminder for tomorrow",
      );
    case "reminder.soon":
      return customer(
        `Today at ${time}`,
        `${service}${withWhom} at ${biz}. See you soon.`,
        ["See you soon: ", `${service} at ${biz}`, ` today at ${time}. Directions: ${link}`],
        "See you soon",
      );
    case "review.request":
      return customer(
        "How was it?",
        `Rate ${service} at ${biz}. It takes ten seconds and helps others choose.`,
        ["How was ", `${service} at ${biz}`, `? Rate it: ${link}#rate`],
        "How was your visit?",
        `${customerHref}#rate`,
      );
    case "provider.new_booking":
      return business("New booking", `${p.customer_name ?? "A customer"} booked ${service}${withWhom}, ${when}.`, [
        "New booking: ",
        `${service}, ${p.customer_name ?? "a customer"}`,
        `, ${when}. Open ${BRAND.name} to see it.`,
      ]);
    case "provider.needs_confirmation":
      return business(
        "Needs your OK",
        `${p.customer_name ?? "A customer"} asked for ${service}${withWhom}, ${when}. Confirm or decline.`,
        [
          "Please confirm: ",
          `${service}, ${p.customer_name ?? "a customer"}`,
          `, ${when}. Open ${BRAND.name} to reply.`,
        ],
      );
    case "provider.cancelled_by_customer":
      return business(
        "Booking cancelled",
        `${p.customer_name ?? "The customer"} cancelled ${service}, ${when}. The time is free again.`,
        ["Cancelled: ", `${service}, ${p.customer_name ?? "customer"}`, `, ${when}. The time is free again.`],
      );
    case "provider.moved_by_customer":
      return business("Booking moved", `${p.customer_name ?? "A customer"} moved ${service} to ${when}.`, [
        "Moved: ",
        `${service}, ${p.customer_name ?? "customer"}`,
        ` is now ${when}.`,
      ]);
    case "provider.upcoming":
      return business(`Next at ${time}`, `${p.customer_name ?? "Your client"}: ${service}${withWhom}.`, [
        "Next at ",
        time,
        `: ${service}, ${p.customer_name ?? "your client"}.`,
      ]);
    case "payment.received":
      // In-app receipt when the business marks money received (ADR-0017: it's paid to them directly).
      return customer(
        "Payment received",
        `${biz} marked ${amount} as received for ${service}, ${when}.`,
        [`${biz} received `, `${amount} for ${service}`, `. Details: ${link}`],
        "Payment received",
      );
    default:
      return {
        title: BRAND.name,
        body: "You have an update.",
        href: "/notifications",
        text: toGsm7(`${BRAND.name}: you have an update.`),
        email: { subject: BRAND.name, text: "You have an update." },
        audience: "customer",
      };
  }
}
