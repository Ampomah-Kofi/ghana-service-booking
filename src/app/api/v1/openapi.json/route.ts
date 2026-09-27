import { publicEnv } from "@/lib/public-env";
import { buildOpenApiDocument } from "@/server/api/openapi";

/** GET /api/v1/openapi.json: machine-readable API description. */
export function GET() {
  return Response.json(buildOpenApiDocument(publicEnv().NEXT_PUBLIC_SITE_URL), {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
