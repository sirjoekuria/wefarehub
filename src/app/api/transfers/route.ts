import { and, desc, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { membershipTransfers, members, pickupStations, users } from "@/db/rh-schema";
import { requireUser, requireAccess, HttpError } from "@/lib/authz";
import { fail, ok, qnum } from "@/lib/rh-api";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireAccess(user.id, orgId);

    const conds: SQL[] = [eq(membershipTransfers.orgId, orgId)];
    if (access.orgRole === null && access.chairStationId !== null) {
      conds.push(
        or(
          eq(membershipTransfers.fromStationId, access.chairStationId),
          eq(membershipTransfers.toStationId, access.chairStationId),
        ) as SQL,
      );
    }
    const rows = await db
      .select()
      .from(membershipTransfers)
      .where(conds.length === 1 ? conds[0] : and(...conds))
      .orderBy(desc(membershipTransfers.id))
      .limit(200);

    const stationIds = [...new Set(rows.flatMap((r) => [r.fromStationId, r.toStationId]))];
    const stations = await db.select({ id: pickupStations.id, name: pickupStations.name }).from(pickupStations).where(
      stationIds.length ? inArr(pickupStations.id, stationIds) : sql`1=0`,
    );
    const sName = new Map(stations.map((s) => [s.id, s.name]));
    const memberIds = [...new Set(rows.map((r) => r.memberId))];
    const memberRows = await db.select({ id: members.id, name: sql`${members.firstName} || ' ' || ${members.surname}`, number: members.membershipNumber }).from(members).where(memberIds.length ? inArr(members.id, memberIds) : sql`1=0`);
    const mById = new Map(memberRows.map((m) => [m.id, m]));
    const userIds = [...new Set(rows.map((r) => r.requestedBy).filter(Boolean) as number[])];
    const users_ = await db.select({ id: users.id, name: users.fullName }).from(users).where(userIds.length ? inArr(users.id, userIds) : sql`1=0`);
    const uById = new Map(users_.map((u) => [u.id, u.name]));

    return ok(
      rows.map((r) => ({
        ...r,
        memberName: mById.get(r.memberId)?.name ?? "—",
        membershipNumber: mById.get(r.memberId)?.number ?? null,
        fromStation: sName.get(r.fromStationId) ?? "—",
        toStation: sName.get(r.toStationId) ?? "—",
        requestedByName: uById.get(r.requestedBy ?? -1) ?? null,
      })),
    );
  } catch (e) {
    return fail(e);
  }
}

import { inArray } from "drizzle-orm";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inArr(col: any, values: number[]) {
  return inArray(col, values);
}
