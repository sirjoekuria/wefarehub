import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/authz";
import { PlatformConsole } from "@/components/platform/PlatformConsole";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.platformRole) redirect("/login");
  return <PlatformConsole role={user.platformRole} />;
}
