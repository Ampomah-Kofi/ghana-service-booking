import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/**
 * Makes the web app installable ("Add to Home Screen"): own icon, full screen without
 * the browser bar, and a splash in the brand colours. No App Store needed yet (SPEC §2).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f4",
    theme_color: "#0f6b4f",
    categories: ["lifestyle", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My bookings", url: "/bookings" },
      { name: "Business dashboard", url: "/dashboard" },
    ],
  };
}
