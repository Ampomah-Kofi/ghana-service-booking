import { NextResponse, type NextRequest } from "next/server";
import { createUserClient } from "@/server/db/supabase-server";
import { safeReturnPath } from "@/lib/safe-return-path";

/**
 * Email confirmation (and future OAuth) lands here with a PKCE `code`.
 * Exchanging it sets the session cookie; then we continue to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeReturnPath(searchParams.get("next"));

  if (code) {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/sign-in?method=email&error=link", origin));
}
