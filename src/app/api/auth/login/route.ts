import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "factoids-auth";
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

const ADMIN_EMAIL = "sasha@getgoally.com";
const ADMIN_PASSWORD = "F@cto!dvideos";

const VIDEO_TEAM_USERNAME = "videoteam";
const VIDEO_TEAM_PASSWORD = "GoallyVideoTeam!!";

type AuthRole = "admin" | "videoteam";

function getRoleForCredentials(identifierRaw: string, password: string): AuthRole | null {
  const identifier = identifierRaw.trim().toLowerCase();

  if (identifier === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return "admin";
  }

  if (identifier === VIDEO_TEAM_USERNAME && password === VIDEO_TEAM_PASSWORD) {
    return "videoteam";
  }

  return null;
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const identifier = body.email ?? "";
  const password = body.password ?? "";

  const role = getRoleForCredentials(identifier, password);

  if (!role) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(AUTH_COOKIE_NAME, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  });

  return response;
}
