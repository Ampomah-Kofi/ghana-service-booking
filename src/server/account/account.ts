import "server-only";
import type { Db } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";

export async function updateMyName(db: Db, userId: string, fullName: string): Promise<void> {
  const { error } = await db.from("profiles").update({ full_name: fullName }).eq("id", userId);
  if (error) throw toAppError(error);
}

/** Why the account can't be deleted yet, or null. */
export async function accountDeletionBlocker(db: Db): Promise<string | null> {
  const { data, error } = await db.rpc("account_deletion_blocker");
  if (error) throw toAppError(error);
  return data ?? null;
}

/**
 * Deletes the caller's account in the database (delete_my_account(): anonymises the business's
 * booking records, keeps reviews as "Former customer", removes the sign-in). No secret key.
 */
export async function deleteMyAccount(db: Db): Promise<void> {
  const { error } = await db.rpc("delete_my_account");
  if (error) throw toAppError(error);
}
