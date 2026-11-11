import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/auth/redirect";

const PUBLIC_PATHS = ["/login", "/register", "/auth/callback"];
const PUBLIC_PREFIXES = ["/api/mcp", "/oauth/token", "/oauth/register", "/oauth/revoke", "/.well-known"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return true;
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Refreshes the Supabase session and sends anonymous visitors to the login page.
 * When Supabase isn't configured, requests pass through and the app layout
 * shows a configuration message instead of portfolio data.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Verifies the session JWT. The app layout calls getUser() again before rendering.
  const { data } = await supabase.auth.getClaims();
  const { pathname } = request.nextUrl;
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !isPublicPath(pathname)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", safeNextPath(`${pathname}${request.nextUrl.search}`));
    return NextResponse.redirect(login);
  }

  if (signedIn && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)",
  ],
};
