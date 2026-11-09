import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMemberships, stationOfficials, pickupStations, organizations } from "@/db/rh-schema";
import { requireUser } from "@/lib/authz";
import { fail, ok } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const [mems, chairs] = await Promise.all([
      db
        .select({
          orgId: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          role: organizationMemberships.role,
        })
        .from(organizationMemberships)
        .innerJoin(organizations, eq(organizationMemberships.orgId, organizations.id))
        .where(eq(organizationMemberships.userId, user.id)),
      db
        .select({
          stationId: pickupStations.id,
          stationName: pickupStations.name,
          orgId: organizations.id,
          orgName: organizations.name,
          orgSlug: organizations.slug,
        })
        .from(stationOfficials)
        .innerJoin(pickupStations, eq(stationOfficials.stationId, pickupStations.id))
        .innerJoin(organizations, eq(pickupStations.orgId, organizations.id))
        .where(
          and(
            eq(stationOfficials.userId, user.id),
            eq(stationOfficials.role, "chairperson"),
            eq(stationOfficials.status, "active"),
          ),
        ),
    ]);
    return ok({
      user: { id: user.id, email: user.email, fullName: user.fullName, platformRole: user.platformRole },
      orgs: mems,
      chairStations: chairs,
    });
  } catch (e) {
    return fail(e);
  }
}
