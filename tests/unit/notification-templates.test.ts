import { describe, expect, it } from "vitest";
import { formatPaymentAmount, renderNotification, TEMPLATE_KEYS, toGsm7 } from "@/lib/notification-templates";
import { BRAND } from "@/lib/brand";

const GSM7 = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà]*$/;
const SITE = "https://hyia.example";

const base = {
  appointment_id: "3c9ac928-5d16-4679-b971-e31f44d83042",
  business_id: "b0000000-0000-4000-8000-000000000001",
  business_name: "Kwame Cuts",
  business_slug: "kwame-cuts",
  timezone: "Africa/Accra",
  service_name: "Skin fade",
  staff_name: "Kwame",
  starts_at: "2026-10-14T09:30:00Z",
  ends_at: "2026-10-14T10:15:00Z",
  customer_name: "Yaw Adjei",
  amount_minor: 2050,
  currency: "GHS",
};

describe("notification templates", () => {
  it("renders every template as one GSM-7 SMS of at most 160 characters", () => {
    for (const key of TEMPLATE_KEYS) {
      for (const payload of [
        base,
        {
          ...base,
          business_name: "Nana Ama’s Braiding & Beauty Palace — East Legon Branch",
          service_name: "Knotless braids (medium) – with extensions and hot oil treatment",
        },
      ]) {
        const r = renderNotification(key, payload, SITE);
        expect(r.text.length, `${key}: ${r.text}`).toBeLessThanOrEqual(160);
        expect(GSM7.test(r.text), `${key} not GSM-7: ${r.text}`).toBe(true);
        expect(r.title.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses the business's clock and links to the booking", () => {
    const r = renderNotification("booking.confirmed", base, SITE);
    expect(r.text).toBe(
      `${BRAND.name}: Booked! Skin fade at Kwame Cuts, Wed, 14 Oct, 9:30 am. Details: ${SITE}/bookings/${base.appointment_id}`,
    );
    expect(r.href).toBe(`/bookings/${base.appointment_id}`);
    expect(r.audience).toBe("customer");
  });

  it("sends businesses to their dashboard and rating prompts to the rating", () => {
    expect(renderNotification("provider.new_booking", base, SITE).href).toBe(
      `/dashboard/${base.business_id}/appointments/${base.appointment_id}`,
    );
    expect(renderNotification("review.request", base, SITE).href).toBe(`/bookings/${base.appointment_id}#rate`);
  });

  it("makes text GSM-7 safe", () => {
    expect(toGsm7("GH₵ 80 – Ama’s “best”…")).toBe(`GHS 80 - Ama's "best"...`);
    expect(toGsm7("Café")).toBe("Cafe");
  });

  it("says how much was paid or refunded, in the booking's currency", () => {
    expect(formatPaymentAmount(2000, "GHS")).toBe("GH₵ 20");
    expect(formatPaymentAmount(2050, "GHS")).toBe("GH₵ 20.50");
    expect(formatPaymentAmount(undefined, "GHS")).toBe("your payment");
    const received = renderNotification("payment.received", base, SITE);
    expect(received.body).toContain("GH₵ 20.50 received");
    expect(received.text.startsWith(`${BRAND.name}: GHS 20.50 received.`)).toBe(true);
    expect(renderNotification("payment.refunded", base, SITE).title).toBe("Refund sent");
  });
});
