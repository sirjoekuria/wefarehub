import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  organizations, pickupStations, members, membershipApplications, organizationSubscriptions,
  subscriptionPlans, organizationMemberships, users, stationOfficials,
} from "@/db/rh-schema";
import { requirePlatform, audit } from "@/lib/authz";
import { fail, ok } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Privileged platform read of a tenant — always audited. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requirePlatform("support");
    const orgId = Number((await params).id);
    const orgs = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const org = orgs[0];
    if (!org) return fail(Object.assign(new Error("Association not found."), { status: 404 }));

    await audit(user.id, orgId, "platform.privileged_access", {
      entity: "organization",
      entityId: orgId,
      details: { actorRole: user.platformRole },
    });

    const [stations, memberList, apps, subs, admins, officials] = await Promise.all([
      db.select().from(pickupStations).where(eq(pickupStations.orgId, orgId)),
      db
        .select()
        .from(members)
        .where(eq(members.orgId, orgId))
        .orderBy(desc(members.id))
        .limit(50),
      db
        .select()
        .from(membershipApplications)
        .where(eq(membershipApplications.orgId, orgId))
        .orderBy(desc(membershipApplications.id))
        .limit(50),
      db
        .select({
          id: organizationSubscriptions.id,
          status: organizationSubscriptions.status,
          planName: subscriptionPlans.name,
          periodEnd: organizationSubscriptions.currentPeriodEnd,
        })
        .from(organizationSubscriptions)
        .innerJoin(subscriptionPlans, eq(organizationSubscriptions.planId, subscriptionPlans.id))
        .where(eq(organizationSubscriptions.orgId, orgId))
        .orderBy(desc(organizationSubscriptions.id)),
      db
        .select({ name: users.fullName, email: users.email, role: organizationMemberships.role })
        .from(organizationMemberships)
        .innerJoin(users, eq(organizationMemberships.userId, users.id))
        .where(eq(organizationMemberships.orgId, orgId)),
      db
        .select({
          station: pickupStations.name,
          role: stationOfficials.role,
          name: users.fullName,
          status: stationOfficials.status,
        })
        .from(stationOfficials)
        .innerJoin(pickupStations, eq(stationOfficials.stationId, pickupStations.id))
        .innerJoin(users, eq(stationOfficials.userId, users.id))
        .where(and(eq(pickupStations.orgId, orgId))),
    ]);

    return ok({ org, stations, members: memberList, applications: apps, subscriptions: subs, admins, officials });
  } catch (e) {
    return fail(e);
  }
}
