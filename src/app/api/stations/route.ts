import { and, asc, eq, sql } from "drizzle-orm";
import { db, persistDb } from "@/db";
import { pickupStations, stationOfficials, users, members, membershipApplications } from "@/db/rh-schema";
import { requireUser, requireAccess, requireOrgRole, assertEntitled, assertCapacity, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

async function stationRows(orgId: number, onlyStationId: number | null) {
  const stConds = [eq(pickupStations.orgId, orgId)];
  if (onlyStationId) stConds.push(eq(pickupStations.id, onlyStationId));
  const stations = await db.select().from(pickupStations).where(and(...stConds)).orderBy(asc(pickupStations.name));

  const officialRows = await db
    .select({
      stationId: stationOfficials.stationId,
      role: stationOfficials.role,
      name: users.fullName,
    })
    .from(stationOfficials)
    .innerJoin(pickupStations, eq(stationOfficials.stationId, pickupStations.id))
    .innerJoin(users, eq(stationOfficials.userId, users.id))
    .where(and(eq(pickupStations.orgId, orgId), eq(stationOfficials.status, "active")));

  const counts = await db
    .select({
      stationId: members.stationId,
      total: sql`count(*)::int`,
      active: sql`count(*) FILTER (WHERE ${members.status} = 'active')::int`,
    })
    .from(members)
    .where(eq(members.orgId, orgId))
    .groupBy(members.stationId);

  const pending = await db
    .select({ stationId: membershipApplications.stationId, n: sql`count(*)::int` })
    .from(membershipApplications)
    .where(and(eq(membershipApplications.orgId, orgId), sql`status NOT IN ('approved','rejected')`))
    .groupBy(membershipApplications.stationId);

  return stations.map((s) => {
    const officials = officialRows.filter((o) => o.stationId === s.id);
    const c = counts.find((x) => x.stationId === s.id);
    const p = pending.find((x) => x.stationId === s.id);
    return {
      ...s,
      memberCount: Number(c?.total ?? 0),
      activeMemberCount: Number(c?.active ?? 0),
      pendingApplications: Number(p?.n ?? 0),
      chairperson: officials.find((o) => o.role === "chairperson")?.name ?? null,
      secretary: officials.find((o) => o.role === "secretary")?.name ?? null,
      deputy: officials.find((o) => o.role === "deputy_chairperson")?.name ?? null,
    };
  });
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireAccess(user.id, orgId);
    const rows = await stationRows(orgId, access.orgRole === null ? access.chairStationId : null);
    return ok(rows);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin"]);
    await assertEntitled(orgId);
    await assertCapacity(orgId, "station");

    const { name, code, location, description } = await body<{
      name?: string; code?: string; location?: string; description?: string;
    }>(req);
    if (!name || !code) throw new HttpError(400, "Station name and code are required.");
    const dup = await db
      .select()
      .from(pickupStations)
      .where(and(eq(pickupStations.orgId, orgId), eq(pickupStations.code, code)));
    if (dup.length > 0) throw new HttpError(409, `Station code ${code} is already in use.`);

    const [row] = await db
      .insert(pickupStations)
      .values({
        orgId,
        name: String(name),
        code: String(code),
        location: location ? String(location) : null,
        description: description ? String(description) : null,
      })
      .returning();
    await audit(user.id, orgId, "station.created", { entity: "station", entityId: row.id, details: { name, code } });
    await persistDb();
    return ok(row, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
