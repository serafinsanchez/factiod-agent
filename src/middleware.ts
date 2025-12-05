import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "factoids-auth";
const AUTH_COOKIE_VALUE = "authenticated";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/favicon.ico",
]);

const isStaticAsset = (pathname: string) =>
  pathname.startsWith("/_next") ||
  pathname.startsWith("/assets") ||
  /\.[a-zA-Z0-9]+$/.test(pathname);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = authToken === AUTH_COOKIE_VALUE;

  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  const redirectTarget = `${pathname}${search}`;

  if (redirectTarget && redirectTarget !== "/") {
    loginUrl.searchParams.set("redirect", redirectTarget);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
