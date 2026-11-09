import { and, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { announcements, pickupStations } from "@/db/rh-schema";
import { requireUser, requireAccess, assertEntitled, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireAccess(user.id, orgId);

    const conds: SQL[] = [eq(announcements.orgId, orgId)];
    if (access.orgRole === null && access.chairStationId !== null)
      conds.push(or(eq(announcements.stationId, access.chairStationId), isNull(announcements.stationId)) as SQL);

    const rows = await db
      .select()
      .from(announcements)
      .where(conds.length === 1 ? conds[0] : and(...conds))
      .orderBy(desc(announcements.createdAt))
      .limit(50);
    const stationIds = [...new Set(rows.map((r) => r.stationId).filter(Boolean) as number[])];
    const stations = stationIds.length
      ? await db
          .select({ id: pickupStations.id, name: pickupStations.name })
          .from(pickupStations)
          .where(inArray(pickupStations.id, stationIds))
      : [];
    const sName = new Map(stations.map((s) => [s.id, s.name]));
    return ok(rows.map((r) => ({ ...r, stationName: r.stationId ? sName.get(r.stationId) ?? null : null })));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireAccess(user.id, orgId);
    await assertEntitled(orgId);

    const { title, body: text, stationId } = await body<{ title?: string; body?: string; stationId?: number | null }>(req);
    if (!title?.trim() || !text?.trim()) throw new HttpError(400, "Title and body are required.");

    let scopeStation: number | null = null;
    if (stationId) {
      if (access.chairStationId !== null) {
        if (Number(stationId) !== access.chairStationId)
          throw new HttpError(403, "Chairpersons can only publish announcements for their own station.");
        scopeStation = access.chairStationId;
      } else {
        const [st] = await db.select().from(pickupStations).where(and(eq(pickupStations.id, stationId), eq(pickupStations.orgId, orgId)));
        if (!st) throw new HttpError(404, "Station not found in this workspace.");
        scopeStation = st.id;
      }
    }

    const [row] = await db
      .insert(announcements)
      .values({ orgId, stationId: scopeStation, title: title.trim(), body: text.trim(), author: user.fullName })
      .returning();
    await audit(user.id, orgId, "announcement.published", { entity: "announcement", entityId: row.id, details: { station: scopeStation } });
    return ok(row, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
