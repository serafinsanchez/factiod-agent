import { cookies } from "next/headers";

import { getStagesForRole } from "@/lib/auth/stageAccess";
import ProjectPageClient from "./ProjectPageClient";

const AUTH_COOKIE_NAME = "factoids-auth";

export default async function ProjectPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const stages = getStagesForRole(role);

  return <ProjectPageClient stages={stages} />;
}
