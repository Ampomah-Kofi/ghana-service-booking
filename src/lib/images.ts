/**
 * Image rules shared by the browser (resizing before upload) and the server (validation).
 * Kept free of heavy imports so client components can use it.
 */
export const IMAGE_LIMITS = {
  smallWidth: 400,
  largeWidth: 1200,
  smallMaxBytes: 300 * 1024,
  largeMaxBytes: 900 * 1024,
  /** What people may pick from their phone before we resize it. */
  maxInputBytes: 25 * 1024 * 1024,
  maxPortfolioPhotos: 12,
} as const;

/** Public URL of a file in the public-media bucket. */
export function publicMediaUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/public-media/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
