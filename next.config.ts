import type { NextConfig } from "next";

// Security headers (Phase 11, docs/security.md). CSP without nonces: nonces would force every page to
// render dynamically, and the app never injects raw HTML (React escapes; no dangerouslySetInnerHTML),
// so inline scripts from Next itself are allowed while everything else is locked to this site and Supabase.
const isDev = process.env.NODE_ENV !== "production";
// HTTPS-only rules apply to deployed environments, not to a production build run locally over http.
const isDeployed = process.env.APP_ENV === "production" || process.env.APP_ENV === "staging";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabase.replace(/^http/, "ws");

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabaseWs}`.trim(),
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(isDeployed ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Location only for "near me" on this site; no camera, microphone or payment APIs.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
  ...(isDeployed ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Photo uploads: two client-resized renditions (≤ 300 KB + ≤ 900 KB) plus multipart overhead.
      bodySizeLimit: "1500kb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
