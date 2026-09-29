import "server-only";
import { nullableArg, type Db } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";

export type ClientSummary = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  hasAccount: boolean;
  visits: number;
  noShows: number;
  upcoming: number;
  lastVisitAt: string | null;
  spentMinor: number;
};

/**
 * A business's clients with visit stats (managers only: the view runs as the caller,
 * so RLS returns nothing to anyone else).
 */
export async function listClients(
  db: Db,
  businessId: string,
  { search = "", sort = "name", limit = 200 }: { search?: string; sort?: "name" | "recent"; limit?: number } = {},
): Promise<ClientSummary[]> {
  let query = db.from("business_client_summaries").select("*").eq("business_id", businessId).limit(limit);
  const term = search
    .trim()
    .replace(/[%_,()]/g, " ")
    .slice(0, 60);
  if (term) {
    const digits = term.replace(/\D/g, "");
    query = query.or(
      [`full_name.ilike.%${term}%`, ...(digits.length >= 3 ? [`phone_e164.ilike.%${digits.slice(-9)}%`] : [])].join(
        ",",
      ),
    );
  }
  query =
    sort === "recent"
      ? query.not("last_visit_at", "is", null).order("last_visit_at", { ascending: false })
      : query.order("full_name");
  const { data, error } = await query;
  if (error) throw toAppError(error);
  return data.flatMap((c) =>
    c.id && c.full_name
      ? [
          {
            id: c.id,
            name: c.full_name,
            phone: c.phone_e164,
            notes: c.notes,
            hasAccount: c.user_id !== null,
            visits: c.visits ?? 0,
            noShows: c.no_shows ?? 0,
            upcoming: c.upcoming ?? 0,
            lastVisitAt: c.last_visit_at,
            spentMinor: Number(c.spent_minor ?? 0),
          },
        ]
      : [],
  );
}

export async function getClient(db: Db, businessId: string, clientId: string): Promise<ClientSummary | null> {
  const { data, error } = await db
    .from("business_client_summaries")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", clientId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw toAppError(error);
  }
  if (!data?.id || !data.full_name) return null;
  return {
    id: data.id,
    name: data.full_name,
    phone: data.phone_e164,
    notes: data.notes,
    hasAccount: data.user_id !== null,
    visits: data.visits ?? 0,
    noShows: data.no_shows ?? 0,
    upcoming: data.upcoming ?? 0,
    lastVisitAt: data.last_visit_at,
    spentMinor: Number(data.spent_minor ?? 0),
  };
}

export async function saveClient(
  db: Db,
  businessId: string,
  input: { id: string | null; name: string; phone: string | null; notes: string | null },
): Promise<string> {
  const { data, error } = await db.rpc("save_business_client", {
    p_business_id: businessId,
    p_client_id: nullableArg(input.id),
    p_name: input.name,
    p_phone: nullableArg(input.phone),
    p_notes: nullableArg(input.notes),
  });
  if (error) throw toAppError(error);
  return data;
}
