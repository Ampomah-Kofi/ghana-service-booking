import { publicEnv } from "@/lib/public-env";
import { businessPageUrl } from "@/lib/share";
import { getBusinessBySlug } from "@/server/businesses/queries";
import { qrPng } from "@/server/businesses/qr";
import { createUserClient } from "@/server/db/supabase-server";

/** Downloadable QR code (PNG) pointing at the business page. Same visibility rules as the page. */
export async function GET(_request: Request, { params }: RouteContext<"/business/[slug]/qr">) {
  const { slug } = await params;
  const business = await getBusinessBySlug(await createUserClient(), slug);
  if (!business) return new Response("Not found", { status: 404 });

  const png = await qrPng(businessPageUrl(publicEnv().NEXT_PUBLIC_SITE_URL, business.slug));
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${business.slug}-qr.png"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
