/**
 * Social links on business profiles. People paste all sorts ("@kwame.cuts", "instagram.com/kwame.cuts/",
 * a full URL with ?igsh=…); we keep just the handle (or a clean https URL) and build links ourselves.
 * The same rules are enforced by check constraints in the database.
 */
export type SocialLinks = {
  instagram: string | null;
  tiktok: string | null;
  x: string | null;
  facebook: string | null;
  youtube: string | null;
  website: string | null;
};

const HANDLE = {
  instagram: { re: /^[A-Za-z0-9._]{1,30}$/, hosts: ["instagram.com"] },
  tiktok: { re: /^[A-Za-z0-9._]{2,24}$/, hosts: ["tiktok.com"] },
  x: { re: /^[A-Za-z0-9_]{1,15}$/, hosts: ["x.com", "twitter.com"] },
} as const;

/** "@kwame.cuts" or "https://www.instagram.com/kwame.cuts/?hl=en" → "kwame.cuts"; invalid → undefined; empty → null. */
export function parseHandle(kind: keyof typeof HANDLE, input: string): string | null | undefined {
  let v = input.trim();
  if (v === "") return null;
  const rule = HANDLE[kind];
  const url = v.match(/^(?:https?:\/\/)?(?:www\.|m\.)?([a-z.]+)\/(@?[^/?#\s]+)/i);
  if (url) {
    if (!rule.hosts.some((h) => url[1].toLowerCase() === h)) return undefined;
    v = url[2];
  }
  v = v.replace(/^@/, "");
  return rule.re.test(v) ? v : undefined;
}

const URL_HOSTS = {
  facebook: /^([a-z0-9-]+\.)?(facebook\.com|fb\.com)$/i,
  youtube: /^((www|m)\.)?(youtube\.com|youtu\.be)$/i,
  website: /^[^\s/]+\.[^\s/]+$/i,
} as const;

/** "facebook.com/kwamecuts" → "https://facebook.com/kwamecuts"; wrong site or not a URL → undefined; empty → null. */
export function parseSocialUrl(kind: keyof typeof URL_HOSTS, input: string): string | null | undefined {
  const v = input.trim();
  if (v === "") return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return undefined;
  }
  if (!URL_HOSTS[kind].test(url.hostname)) return undefined;
  url.protocol = "https:";
  const clean = url.toString().replace(/\/$/, "");
  return clean.length <= 200 && (kind === "website" || url.pathname.length > 1) ? clean : undefined;
}

export function socialHref(kind: keyof SocialLinks, value: string): string {
  switch (kind) {
    case "instagram":
      return `https://www.instagram.com/${value}`;
    case "tiktok":
      return `https://www.tiktok.com/@${value}`;
    case "x":
      return `https://x.com/${value}`;
    default:
      return value;
  }
}

export const SOCIAL_LABELS: Record<keyof SocialLinks, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  facebook: "Facebook",
  youtube: "YouTube",
  website: "Website",
};

/** What to show on the chip: "@kwame.cuts", "kwamecuts.com". */
export function socialDisplay(kind: keyof SocialLinks, value: string): string {
  if (kind === "instagram" || kind === "tiktok" || kind === "x") return `@${value}`;
  try {
    const u = new URL(value);
    return kind === "website" ? u.hostname.replace(/^www\./, "") : SOCIAL_LABELS[kind];
  } catch {
    return SOCIAL_LABELS[kind];
  }
}
