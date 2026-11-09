import { and, eq } from "drizzle-orm";
import { db, persistDb } from "@/db";
import { pickupStations, stationOfficials, members } from "@/db/rh-schema";
import { requireUser, requireOrgRole, assertEntitled, assertStation, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Association officials only. Chairpersons intentionally cannot modify
 * stations (assignment, officials, archiving) — by design.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    const stationId = Number((await params).id);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin"]);
    const station = await assertStation(access, stationId);
    await assertEntitled(orgId);

    const b = await body<Record<string, unknown>>(req);
    const set: Record<string, unknown> = {};
    if (typeof b.name === "string" && b.name.trim()) set.name = b.name.trim();
    if (typeof b.code === "string" && b.code.trim()) {
      const dup = await db.select().from(pickupStations).where(and(eq(pickupStations.orgId, orgId), eq(pickupStations.code, b.code.trim()), sql_ne(stationId)));
      if (dup.length > 0) throw new HttpError(409, `Station code ${b.code} is already in use.`);
      set.code = b.code.trim();
    }
    if ("location" in b) set.location = b.location ? String(b.location) : null;
    if ("description" in b) set.description = b.description ? String(b.description) : null;
    if (b.isArchived === true && !station.isArchived) {
      const [c] = await db.select({ n: sql_count() }).from(members).where(eq(members.stationId, stationId));
      if (Number(c?.n ?? 0) > 0) throw new HttpError(409, "Transfer or remove members before archiving this station.");
      set.isArchived = true;
    }

    if (Object.keys(set).length > 0)
      await db.update(pickupStations).set(set as never).where(eq(pickupStations.id, stationId));

    // officials: set a userId (0/null = remove)
    const officialUpdates: { role: "chairperson" | "secretary" | "deputy_chairperson"; userId: number | null }[] = [];
    for (const role of ["chairperson", "secretary", "deputy_chairperson"] as const) {
      const key = `${role}UserId`;
      if (key in b) {
        const v = b[key];
        officialUpdates.push({ role, userId: v == null || Number(v) === 0 ? null : Number(v) });
      }
    }
    for (const u of officialUpdates) {
      await db.transaction(async (tx) => {
        await tx.update(stationOfficials).set({ status: "inactive" }).where(and(eq(stationOfficials.stationId, stationId), eq(stationOfficials.role, u.role), eq(stationOfficials.status, "active")));
        if (u.userId != null) {
          // a user can only be active chairperson of one station at a time
          if (u.role === "chairperson") {
            const other = await tx
              .select()
              .from(stationOfficials)
              .where(and(eq(stationOfficials.userId, u.userId), eq(stationOfficials.role, "chairperson"), eq(stationOfficials.status, "active")));
            for (const o of other)
              await tx.update(stationOfficials).set({ status: "inactive" }).where(eq(stationOfficials.id, o.id));
          }
          const existing = await tx.select().from(stationOfficials).where(and(eq(stationOfficials.stationId, stationId), eq(stationOfficials.userId, u.userId), eq(stationOfficials.role, u.role)));
          if (existing.length > 0) {
            await tx.update(stationOfficials).set({ status: "active" }).where(eq(stationOfficials.id, existing[0].id));
          } else {
            await tx.insert(stationOfficials).values({ stationId, userId: u.userId, role: u.role, status: "active" });
          }
        }
      });
      await audit(user.id, orgId, "station.official_changed", {
        entity: "station",
        entityId: stationId,
        details: { role: u.role, userId: u.userId },
      });
    }

    if (Object.keys(set).length > 0)
      await audit(user.id, orgId, "station.updated", { entity: "station", entityId: stationId, details: { fields: Object.keys(set) } });
    await persistDb();
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

// tiny helpers to keep drizzle operators inline
import { sql } from "drizzle-orm";
function sql_ne(id: number) {
  return sql`${pickupStations.id} != ${id}`;
}
function sql_count() {
  return sql`count(*)::int`;
}
