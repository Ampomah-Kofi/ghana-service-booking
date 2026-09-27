import "server-only";
import { createUserClient } from "@/server/db/supabase-server";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";

export type MyProfile = {
  id: string;
  fullName: string | null;
  phoneE164: string | null;
  email: string | null;
  locale: string;
};

/** The caller's own profile (RLS: profiles are readable only by their owner). */
export async function getMyProfile(): Promise<MyProfile | null> {
  const user = await requireUser();
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone_e164, email, locale")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new AppError("INTERNAL", "Could not load your profile.");
  if (!data) return null;
  return { id: data.id, fullName: data.full_name, phoneE164: data.phone_e164, email: data.email, locale: data.locale };
}
