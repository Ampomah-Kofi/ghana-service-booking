import { describe, expect, it } from "vitest";
import { buildShareLinks, businessPageUrl, mapsUrl, telUrl, whatsappChatUrl } from "@/lib/share";
import { publicMediaUrl } from "@/lib/images";

describe("share links", () => {
  const url = "https://hyia.app/business/kwame-cuts";

  it("builds WhatsApp, Facebook and SMS links with the page URL encoded", () => {
    const links = buildShareLinks("Kwame Cuts & Co", url);
    expect(links.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(`Book Kwame Cuts & Co online: ${url}`)}`);
    expect(links.facebook).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    expect(links.sms.startsWith("sms:?&body=")).toBe(true);
    expect(decodeURIComponent(links.sms)).toContain(url);
  });

  it("builds contact links from E.164 numbers", () => {
    expect(whatsappChatUrl("+233241234567")).toBe("https://wa.me/233241234567");
    expect(telUrl("+233241234567")).toBe("tel:+233241234567");
    expect(mapsUrl(5.6, -0.18)).toBe("https://www.google.com/maps/search/?api=1&query=5.6,-0.18");
  });

  it("builds page and media URLs without double slashes", () => {
    expect(businessPageUrl("https://hyia.app/", "kwame-cuts")).toBe(url);
    expect(publicMediaUrl("http://127.0.0.1:54321/", "businesses/b1/photos/a b-400.webp")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/public-media/businesses/b1/photos/a%20b-400.webp",
    );
  });
});
