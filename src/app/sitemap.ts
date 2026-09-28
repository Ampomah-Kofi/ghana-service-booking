import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/public-env";
import { createPublicClient } from "@/server/db/supabase-server";

// Built on request (and cached by the CDN), so a build never needs the database.
export const dynamic = "force-dynamic";

/** Published business pages and active categories, so people can find businesses from search engines. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const db = createPublicClient();
  const [businesses, categories] = await Promise.all([
    db
      .from("businesses")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(5000),
    db.from("categories").select("slug").eq("is_active", true),
  ]);
  return [
    { url: `${site}/`, changeFrequency: "daily", priority: 1 },
    ...(categories.data ?? []).map((c) => ({
      url: `${site}/categories/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...(businesses.data ?? []).map((b) => ({
      url: `${site}/business/${b.slug}`,
      lastModified: b.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
