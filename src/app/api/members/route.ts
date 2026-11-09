import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  members, pickupStations, memberCustomFieldDefinitions, memberCustomFieldValues, membershipTransfers,
} from "@/db/rh-schema";
import { requireUser, requireAccess, HttpError } from "@/lib/authz";
import { fail, ok, qnum, query } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireAccess(user.id, orgId);
    const isChair = access.orgRole === null && access.chairStationId !== null;

    const conds: SQL[] = [eq(members.orgId, orgId)];
    if (isChair) conds.push(eq(members.stationId, access.chairStationId!));
    const stationId = qnum(req, "stationId");
    if (stationId && !isChair) conds.push(eq(members.stationId, stationId));
    const status = query(req, "status");
    if (status)
      conds.push(
        eq(
          members.status,
          status as "pending" | "active" | "suspended" | "inactive" | "transferred" | "deceased" | "archived",
        ),
      );
    const q = query(req, "q");
    if (q)
      conds.push(
        or(
          ilike(members.firstName, `%${q}%`),
          ilike(members.surname, `%${q}%`),
          ilike(members.phone, `%${q}%`),
          ilike(members.membershipNumber, `%${q}%`),
        ) as SQL,
      );

    const rows = await db
      .select()
      .from(members)
      .where(conds.length === 1 ? conds[0] : and(...conds))
      .orderBy(desc(members.id))
      .limit(300);

    // station names
    const stations = await db
      .select({ id: pickupStations.id, name: pickupStations.name })
      .from(pickupStations)
      .where(sql`${pickupStations.id} IN (SELECT DISTINCT station_id FROM members WHERE org_id = ${orgId})`);
    const stationName = new Map(stations.map((s) => [s.id, s.name]));

    // custom values (definition label → display value)
    const defs = await db
      .select()
      .from(memberCustomFieldDefinitions)
      .where(sql`${memberCustomFieldDefinitions.orgId} = ${orgId}`);
    const defById = new Map(defs.map((d) => [d.id, d]));
    const values = rows.length
      ? await db
          .select()
          .from(memberCustomFieldValues)
          .where(sql`${memberCustomFieldValues.memberId} IN (${sql.join(rows.map((r) => sql`${r.id}`), sql`, `)})`)
      : [];
    const transfers = rows.length
      ? await db
          .select({ memberId: membershipTransfers.memberId, n: sql`count(*)::int` })
          .from(membershipTransfers)
          .where(sql`${membershipTransfers.orgId} = ${orgId}`)
          .groupBy(membershipTransfers.memberId)
      : [];
    const tCount = new Map(transfers.map((t) => [t.memberId, Number(t.n ?? 0)]));
    const valuesByMember = new Map<number, Record<string, string>>();
    for (const v of values) {
      const def = defById.get(v.fieldId);
      if (!def) continue;
      const val = v.valueText ?? (v.valueNumber != null ? String(v.valueNumber) : v.valueDate ? String(v.valueDate) : "");
      if (val == null || val === "") continue;
      const map = valuesByMember.get(v.memberId) ?? {};
      map[def.label] = String(val);
      valuesByMember.set(v.memberId, map);
    }

    return ok(
      rows.map((m) => ({
        ...m,
        stationName: stationName.get(m.stationId) ?? "—",
        customValues: valuesByMember.get(m.id) ?? {},
        transferCount: tCount.get(m.id) ?? 0,
      })),
    );
  } catch (e) {
    return fail(e);
  }
}
