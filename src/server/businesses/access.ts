import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getBusinessRole, MANAGER_ROLES, type MemberRole } from "@/server/auth/roles";
import { createUserClient } from "@/server/db/supabase-server";
import type { Db } from "@/server/db/client";
import { getBusinessById, type BusinessView } from "./queries";

export type ManagedBusiness = { db: Db; business: BusinessView; role: MemberRole };

/**
 * For actions: the caller must be an owner or manager of the business.
 * Throws FORBIDDEN for everyone else (the database would refuse anyway; this gives a clear message).
 */
export async function requireManagedBusiness(businessId: unknown): Promise<ManagedBusiness> {
  const id = z.uuid().safeParse(businessId);
  if (!id.success) throw new AppError("NOT_FOUND", "Business not found.");
  const role = await getBusinessRole(id.data);
  if (!role || !MANAGER_ROLES.includes(role))
    throw new AppError("FORBIDDEN", "You don't have access to this business.");
  const db = await createUserClient();
  const business = await getBusinessById(db, id.data);
  if (!business) throw new AppError("NOT_FOUND", "Business not found.");
  return { db, business, role };
}

/** For pages: 404 instead of revealing that a business exists. */
export async function managedBusinessOr404(businessId: string): Promise<ManagedBusiness> {
  try {
    return await requireManagedBusiness(businessId);
  } catch (error) {
    if (error instanceof AppError && error.code !== "INTERNAL") notFound();
    throw error;
  }
}
