import { cookies } from "next/headers";

import { getStagesForRole } from "@/lib/auth/stageAccess";

import SettingsPageClient from "./SettingsPageClient";

const AUTH_COOKIE_NAME = "factoids-auth";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const stages = getStagesForRole(role);

  return <SettingsPageClient role={role} stages={stages} />;
}
