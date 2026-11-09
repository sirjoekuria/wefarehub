import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  members, membershipApplications, pickupStations, stationOfficials, users, announcements,
} from "@/db/rh-schema";
import { requireUser, requireAccess, getSubscription, HttpError } from "@/lib/authz";
import { fail, ok, qnum } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

const PENDING = ["submitted", "chairperson_review", "recommended", "not_recommended", "pending_final", "changes_requested"] as const;
const pendingIn = inArray(membershipApplications.status, [...PENDING]);

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireAccess(user.id, orgId);
    const isChair = access.orgRole === null && access.chairStationId !== null;
    const stationFilter = isChair ? access.chairStationId! : null;

    const memberWhere: SQL | undefined = stationFilter
      ? and(eq(members.orgId, orgId), eq(members.stationId, stationFilter))
      : eq(members.orgId, orgId);
    const appWhere: SQL | undefined = stationFilter
      ? and(eq(membershipApplications.orgId, orgId), eq(membershipApplications.stationId, stationFilter))
      : eq(membershipApplications.orgId, orgId);

    const annConds: SQL[] = [eq(announcements.orgId, orgId)];
    if (stationFilter)
      annConds.push(or(eq(announcements.stationId, stationFilter), isNull(announcements.stationId)) as SQL);

    const [totalM, activeM, suspendedM, pendingA, recentM, stationsAll, anns, growthRows] = await Promise.all([
      db.select({ n: sql`count(*)::int` }).from(members).where(memberWhere as SQL),
      db.select({ n: sql`count(*)::int` }).from(members).where(memberWhere ? and(memberWhere, eq(members.status, "active")) : undefined),
      db.select({ n: sql`count(*)::int` }).from(members).where(memberWhere ? and(memberWhere, eq(members.status, "suspended")) : undefined),
      db.select({ n: sql`count(*)::int` }).from(membershipApplications).where(appWhere ? and(appWhere, pendingIn) : pendingIn),
      db.select().from(members).where(memberWhere).orderBy(desc(members.id)).limit(6),
      db
        .select()
        .from(pickupStations)
        .where(
          and(
            eq(pickupStations.orgId, orgId),
            eq(pickupStations.isArchived, false),
            // chairpersons see only their own station — no other stations' stats
            ...(stationFilter ? [eq(pickupStations.id, stationFilter)] : []),
          ),
        )
        .orderBy(asc(pickupStations.name)),
      db.select().from(announcements).where(annConds.length === 1 ? annConds[0] : and(...annConds)).orderBy(desc(announcements.createdAt)).limit(4),
      db
        .select({ month: sql<string>`to_char(${members.registrationDate}, 'YYYY-MM')`, n: sql`count(*)::int` })
        .from(members)
        .where(and(memberWhere as SQL, sql`${members.registrationDate} IS NOT NULL`))
        .groupBy(sql`to_char(${members.registrationDate}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${members.registrationDate}, 'YYYY-MM') desc`)
        .limit(6),
    ]);

    const stationRows = await Promise.all(
      stationsAll.map(async (s) => {
        const [m, a, p, chair] = await Promise.all([
          db.select({ n: sql`count(*)::int` }).from(members).where(eq(members.stationId, s.id)),
          db.select({ n: sql`count(*)::int` }).from(members).where(and(eq(members.stationId, s.id), eq(members.status, "active"))),
          db.select({ n: sql`count(*)::int` }).from(membershipApplications).where(and(eq(membershipApplications.stationId, s.id), pendingIn)),
          db
            .select({ name: users.fullName })
            .from(stationOfficials)
            .innerJoin(users, eq(stationOfficials.userId, users.id))
            .where(
              and(
                eq(stationOfficials.stationId, s.id),
                eq(stationOfficials.role, "chairperson"),
                eq(stationOfficials.status, "active"),
              ),
            ),
        ]);
        return {
          id: s.id,
          name: s.name,
          code: s.code,
          members: Number(m[0].n ?? 0),
          active: Number(a[0].n ?? 0),
          pending: Number(p[0].n ?? 0),
          chairperson: chair[0]?.name ?? null,
        };
      }),
    );

    const sub = await getSubscription(orgId);

    return ok({
      scope: isChair ? "station" : "org",
      stationId: stationFilter,
      stats: {
        totalMembers: Number(totalM[0].n ?? 0),
        activeMembers: Number(activeM[0].n ?? 0),
        suspended: Number(suspendedM[0].n ?? 0),
        pendingApplications: Number(pendingA[0].n ?? 0),
      },
      stations: stationRows,
      recent: recentM.map((m) => ({
        id: m.id,
        name: `${m.firstName} ${m.surname}`,
        number: m.membershipNumber,
        status: m.status,
        stationId: m.stationId,
        date: m.registrationDate,
      })),
      growth: growthRows.map((g) => ({ month: g.month, n: Number(g.n ?? 0) })),
      announcements: anns.map((a) => ({ id: a.id, title: a.title, stationId: a.stationId, createdAt: a.createdAt, author: a.author })),
      subscription: sub
        ? {
            status: sub.status,
            planName: sub.planName,
            planCode: sub.planCode,
            billingCycle: sub.billingCycle,
            currentPeriodEnd: sub.currentPeriodEnd,
            maxStations: sub.maxStations,
            maxMembers: sub.maxMembers,
          }
        : null,
    });
  } catch (e) {
    return fail(e);
  }
}
