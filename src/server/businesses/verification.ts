import "server-only";
import type { Db } from "@/server/db/client";
import { nullableArg } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";
import type { Database } from "@/server/db/types";

/**
 * The verified check mark (ADR-0015). Owners apply; a platform admin checks the owner's details
 * and decides; every decision is audited in the database. Renaming a business removes the check.
 */
export type VerificationStatus = Database["public"]["Enums"]["business_verification"];

/** The admin's note to the owner (e.g. why it was declined). Only the owner and admins can read it (RLS). */
export async function getVerificationNote(db: Db, businessId: string): Promise<string | null> {
  const { data, error } = await db
    .from("business_verification_notes")
    .select("note")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data?.note ?? null;
}

export async function requestVerification(db: Db, businessId: string): Promise<VerificationStatus> {
  const { data, error } = await db.rpc("request_business_verification", { p_business_id: businessId });
  if (error) throw toAppError(error);
  return data;
}

export type VerificationQueueItem = {
  id: string;
  slug: string;
  name: string;
  status: VerificationStatus;
  requestedAt: string | null;
  verifiedAt: string | null;
  phone: string | null;
  place: string | null;
  categoryName: string | null;
};

/** Admin: businesses waiting for a decision (oldest first), then the verified ones (newest first). */
export async function listVerificationQueue(
  db: Db,
): Promise<{ pending: VerificationQueueItem[]; verified: VerificationQueueItem[] }> {
  const { data, error } = await db
    .from("businesses")
    .select(
      `id, slug, name, verification_status, verification_requested_at, verified_at, phone_e164,
       business_categories ( is_primary, categories ( name ) ),
       business_locations ( is_primary, locality_text, cities ( name ), areas ( name ) )`,
    )
    .in("verification_status", ["pending", "verified"])
    .is("deleted_at", null)
    .order("verification_requested_at", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw toAppError(error);
  const items = data.map((b): VerificationQueueItem => {
    const location = b.business_locations.find((l) => l.is_primary) ?? b.business_locations[0];
    const category = b.business_categories.find((c) => c.is_primary) ?? b.business_categories[0];
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      status: b.verification_status,
      requestedAt: b.verification_requested_at,
      verifiedAt: b.verified_at,
      phone: b.phone_e164,
      place: location
        ? [location.areas?.name, location.cities?.name ?? location.locality_text].filter(Boolean).join(", ") || null
        : null,
      categoryName: category?.categories?.name ?? null,
    };
  });
  return {
    pending: items.filter((i) => i.status === "pending"),
    verified: items
      .filter((i) => i.status === "verified")
      .sort((a, b) => (b.verifiedAt ?? "").localeCompare(a.verifiedAt ?? "")),
  };
}

/** Admin decision: verified, declined (with an optional note to the owner) or none (remove the check). */
export async function setVerification(
  db: Db,
  businessId: string,
  status: Exclude<VerificationStatus, "pending">,
  reason: string,
  note: string | null,
): Promise<void> {
  const { error } = await db.rpc("admin_set_business_verification", {
    p_business_id: businessId,
    p_status: status,
    p_reason: reason,
    p_note: nullableArg(note),
  });
  if (error) throw toAppError(error);
}
