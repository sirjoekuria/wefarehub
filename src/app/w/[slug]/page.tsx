import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, pickupStations } from "@/db/rh-schema";
import { getSessionUser, getAccess, getOrgBySlug } from "@/lib/authz";
import { Workspace } from "@/components/workspace/Workspace";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const access = await getAccess(user.id, org.id);
  if (!access.isOrgMember && access.chairStationId === null)
    redirect(user.platformRole ? "/platform" : "/login");

  let chairStationName: string | null = null;
  if (access.chairStationId !== null) {
    const [st] = await db
      .select({ name: pickupStations.name })
      .from(pickupStations)
      .where(eq(pickupStations.id, access.chairStationId));
    chairStationName = st?.name ?? null;
  }

  return (
    <Workspace
      initial={{
        user: { id: user.id, email: user.email, fullName: user.fullName, platformRole: user.platformRole },
        org: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          code: org.code,
          motto: org.motto,
          logoUrl: org.logoUrl,
          primaryColor: org.primaryColor,
          secondaryColor: org.secondaryColor,
          accentColor: org.accentColor,
          county: org.county,
          location: org.location,
          phone: org.phone,
          email: org.email,
          registrationNumber: org.registrationNumber,
          description: org.description,
          status: org.status,
          formVersion: org.formVersion,
        },
        role: access.orgRole,
        chairStationId: access.chairStationId,
        chairStationName,
      }}
    />
  );
}
