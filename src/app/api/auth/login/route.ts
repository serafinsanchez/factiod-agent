import { NextResponse } from "next/server";

const VALID_EMAIL = "sasha@getgoally.com";
const VALID_PASSWORD = "F@cto!dvideos";
const AUTH_COOKIE_NAME = "factoids-auth";
const AUTH_COOKIE_VALUE = "authenticated";
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  let body: { email?: string; password?: string } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (email !== VALID_EMAIL || password !== VALID_PASSWORD) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  });

  return response;
}
