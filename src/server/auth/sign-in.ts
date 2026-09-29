import "server-only";
import { createUserClient } from "@/server/db/supabase-server";
import { serverEnv } from "@/server/env";
import { publicEnv } from "@/lib/public-env";
import { e164Schema, emailSignInSchema, emailSignUpSchema, otpCodeSchema, phoneInputSchema } from "@/schemas/auth";

/**
 * Auth use-cases (business logic lives in src/server, not in actions/components).
 * All return a discriminated result; user-facing messages only, never raw provider errors.
 */
export type AuthResult<T = null> =
  { ok: true; value: T } | { ok: false; fieldErrors?: Record<string, string>; message: string };

function friendlyAuthError(status: number | undefined, code: string | undefined): string {
  if (status === 429 || code === "over_sms_send_rate_limit" || code === "over_request_rate_limit") {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (code === "otp_expired") return "That code is wrong or has expired. Request a new one.";
  if (code === "invalid_credentials") return "Email or password is incorrect.";
  if (code === "email_not_confirmed") return "Please confirm your email first. Check your inbox.";
  if (code === "user_already_exists" || code === "email_exists")
    return "An account with this email already exists. Sign in instead.";
  if (code === "weak_password") return "Choose a stronger password.";
  return "Something went wrong. Please try again.";
}

export async function requestPhoneOtp(rawPhone: string): Promise<AuthResult<{ phone: string }>> {
  const parsed = phoneInputSchema(serverEnv().DEFAULT_COUNTRY_CODE).safeParse(rawPhone);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid phone number.";
    return { ok: false, fieldErrors: { phone: message }, message };
  }
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data, options: { channel: "sms" } });
  if (error) return { ok: false, message: friendlyAuthError(error.status, error.code) };
  return { ok: true, value: { phone: parsed.data } };
}

export async function verifyPhoneOtp(rawPhone: string, rawCode: string): Promise<AuthResult> {
  const phone = e164Schema.safeParse(rawPhone);
  if (!phone.success) return { ok: false, message: "Start again and re-enter your phone number." };
  const code = otpCodeSchema.safeParse(rawCode);
  if (!code.success) {
    const message = code.error.issues[0]?.message ?? "Invalid code.";
    return { ok: false, fieldErrors: { code: message }, message };
  }
  const supabase = await createUserClient();
  const { error } = await supabase.auth.verifyOtp({ phone: phone.data, token: code.data, type: "sms" });
  if (error) {
    // Supabase answers a wrong or expired code with 403 otp_expired.
    const message = friendlyAuthError(error.status, error.status === 403 ? "otp_expired" : error.code);
    return { ok: false, fieldErrors: { code: message }, message };
  }
  return { ok: true, value: null };
}

export async function signInWithEmailPassword(input: { email: string; password: string }): Promise<AuthResult> {
  const parsed = emailSignInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: friendlyAuthError(error.status, error.code) };
  return { ok: true, value: null };
}

export async function signUpWithEmailPassword(input: { email: string; password: string }): Promise<AuthResult> {
  const parsed = emailSignUpSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, fieldErrors, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  if (error) return { ok: false, message: friendlyAuthError(error.status, error.code) };
  return { ok: true, value: null };
}

export async function signOut(): Promise<void> {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
}
