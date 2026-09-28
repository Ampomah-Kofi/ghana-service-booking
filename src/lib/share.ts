/**
 * Share links for a business page (SPEC §6). Instagram and TikTok have no web
 * share URL, so for them the UI offers "copy link" instead.
 */
export type ShareLinks = {
  whatsapp: string;
  facebook: string;
  sms: string;
};

export function shareMessage(businessName: string, url: string): string {
  return `Book ${businessName} online: ${url}`;
}

export function buildShareLinks(businessName: string, url: string): ShareLinks {
  const text = shareMessage(businessName, url);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    // "sms:?&body=" works on both iOS and Android.
    sms: `sms:?&body=${encodeURIComponent(text)}`,
  };
}

/** Opens a WhatsApp chat with the business ("https://wa.me/233241234567"). */
export function whatsappChatUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}`;
}

export function telUrl(e164: string): string {
  return `tel:${e164.replace(/[^\d+]/g, "")}`;
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function businessPageUrl(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/$/, "")}/business/${slug}`;
}

/** Directions when a business has no pin: a maps search for its name and address. */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
