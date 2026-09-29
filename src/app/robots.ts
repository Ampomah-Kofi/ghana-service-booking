import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/public-env";

/** Search engines may index the marketplace, never people's accounts, dashboards or the API. */
export default function robots(): MetadataRoute.Robots {
  const site = publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account",
          "/admin",
          "/api/",
          "/bookings",
          "/dashboard",
          "/invite",
          "/notifications",
          "/onboarding",
          "/sign-in",
          "/favorites",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}
