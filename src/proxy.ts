import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/resend-verification",
];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isPublicPath = PUBLIC_PATHS.some((path) => nextUrl.pathname.startsWith(path));

  if (!isLoggedIn && !isPublicPath) {
    const loginUrl = new URL("/login", nextUrl);
    // Preserve the query string too, not just the path — /oauth/authorize's
    // entire request (client_id, redirect_uri, code_challenge, ...) lives in
    // its query params, and would otherwise be silently dropped on the
    // round trip through login.
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
});

export const config = {
  // .well-known is excluded alongside api/_next/*: OAuth discovery metadata
  // (RFC 8414/9728, served under src/app/api/well-known/ via the
  // next.config.ts rewrite) must be fetchable by an unauthenticated client
  // before any session exists — that's the entire point of the convention.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|\\.well-known).*)"],
};
