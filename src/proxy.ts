import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on each page request, so Server
 * Components (which can't write cookies) see a valid session, and sends
 * signed-out visitors of protected pages to sign-in with a real 307.
 * This is NOT the authorization layer: pages and actions check access
 * themselves (src/server/auth), and the database enforces RLS.
 */
const PROTECTED_PREFIXES = ["/account", "/bookings", "/onboarding", "/dashboard", "/invite", "/admin"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers)) response.headers.set(header, value);
      },
    },
  });

  // Validates the token and refreshes it if expired. Don't put code between
  // client creation and this call.
  const { data } = await supabase.auth.getClaims();

  if (!data && isProtected(request.nextUrl.pathname)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(signIn);
    // Keep any cookie changes (e.g. a cleared stale session) made by getClaims() above.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets, image optimisation and all /api routes (Bearer-token API and signed hooks; no cookie session).
    "/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
