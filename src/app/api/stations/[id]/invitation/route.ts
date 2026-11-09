import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

/**
 * Short, unambiguous token (32-char alphabet, no 0/O/1/l/I) — 6 chars ≈
 * 1 billion possibilities; tokens also expire, are revocable and unique.
 */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
function makeToken() {
  const bytes = randomBytes(6);
  let t = "";
  for (let i = 0; i < 6; i++) t += ALPHABET[bytes[i] % 32];
  return t;
}
async function shortToken(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const t = makeToken();
    const [dup] = await db.select({ id: registrationInvitations.id }).from(registrationInvitations).where(eq(registrationInvitations.token, t)).limit(1);
    if (!dup) return t;
  }
  // practically unreachable — fall back to a longer token
  return randomBytes(12).toString("hex");
}
import { db } from "@/db";
import { registrationInvitations, pickupStations } from "@/db/rh-schema";
import { requireUser, requireOrgRole, assertEntitled, assertStation, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    const stationId = Number((await params).id);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin"]);
    await assertStation(access, stationId);
    await assertEntitled(orgId);

    const { action } = await body<{ action?: string; expiresDays?: number; maxUses?: number }>(req);

    if (action === "list") {
      const active = await db
        .select()
        .from(registrationInvitations)
        .where(and(eq(registrationInvitations.stationId, stationId), eq(registrationInvitations.isRevoked, false)))
        .limit(1);
      const row = active[0] ?? null;
      return ok({ active: row && row.expiresAt.getTime() > Date.now() ? row : null });
    }

    if (action === "create") {
      const active = await db
        .select()
        .from(registrationInvitations)
        .where(
          and(
            eq(registrationInvitations.stationId, stationId),
            eq(registrationInvitations.isRevoked, false),
            sql`${registrationInvitations.expiresAt} > now()`,
          ),
        );
      if (active.length > 0) throw new HttpError(409, "An active invitation already exists for this station. Revoke it first.");
      const token = await shortToken();
      const [row] = await db
        .insert(registrationInvitations)
        .values({
          orgId,
          stationId,
          token,
          expiresAt: new Date(Date.now() + 30 * 86400000),
          maxUses: 100,
          usesCount: 0,
          isRevoked: false,
          createdBy: user.id,
        })
        .returning();
      await audit(user.id, orgId, "invitation.created", { entity: "station", entityId: stationId, details: { token: `${token.slice(0, 4)}…` } });
      return ok(row, { status: 201 });
    }

    if (action === "revoke") {
      const active = await db
        .select()
        .from(registrationInvitations)
        .where(and(eq(registrationInvitations.stationId, stationId), eq(registrationInvitations.isRevoked, false)));
      for (const a of active)
        await db.update(registrationInvitations).set({ isRevoked: true }).where(eq(registrationInvitations.id, a.id));
      await audit(user.id, orgId, "invitation.revoked", { entity: "station", entityId: stationId, details: { count: active.length } });
      return ok({ ok: true });
    }

    throw new HttpError(400, "action must be create or revoke.");
  } catch (e) {
    return fail(e);
  }
}


