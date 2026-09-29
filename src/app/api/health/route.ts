import { createPublicClient } from "@/server/db/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health: for uptime monitors (docs/deployment.md). 200 when the app can read from the
 * database as an anonymous visitor; 503 otherwise. Says nothing about data or configuration.
 */
export async function GET() {
  const started = Date.now();
  try {
    const { error } = await createPublicClient()
      .from("categories")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) throw error;
    return Response.json(
      { status: "ok", database: "ok", ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "error", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
