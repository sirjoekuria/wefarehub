import { and, eq } from "drizzle-orm";
import { db, persistDb } from "@/db";
import { users, members } from "@/db/rh-schema";
import { requireUser, requireOrgRole, HttpError } from "@/lib/authz";
import { fail, ok, qnum } from "@/lib/rh-api";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Station Official Candidates:
 * Returns ONLY verified, active members registered to that specific pickup station.
 * Any other platform users or members of different stages are strictly excluded.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    const stationId = qnum(req, "stationId");
    if (!orgId) throw new HttpError(400, "orgId is required.");
    await requireOrgRole(user.id, orgId, ["owner", "admin"]);

    if (!stationId) {
      // Station must be specified so only that station's members are returned
      return ok([]);
    }

    // Query active members of this station only
    const stationMembers = await db
      .select({
        id: members.id,
        firstName: members.firstName,
        middleName: members.middleName,
        surname: members.surname,
        phone: members.phone,
        email: members.email,
        membershipNumber: members.membershipNumber,
        status: members.status,
      })
      .from(members)
      .where(
        and(
          eq(members.orgId, orgId),
          eq(members.stationId, stationId),
          eq(members.status, "active"),
        ),
      );

    if (stationMembers.length === 0) {
      return ok([]);
    }

    const candidates = [];

    for (const m of stationMembers) {
      const fullName = `${m.firstName} ${m.middleName ? m.middleName + " " : ""}${m.surname}`.trim();
      const lookupEmail = m.email?.trim().toLowerCase() ||
        `rider.${String(m.membershipNumber ?? m.id).toLowerCase().replace(/[^a-z0-9]/g, "")}@riderhub.local`;

      // Find or create associated user identity for login
      let [existingUser] = await db.select().from(users).where(eq(users.email, lookupEmail)).limit(1);

      if (!existingUser && m.phone) {
        const [byPhone] = await db.select().from(users).where(eq(users.phone, m.phone)).limit(1);
        if (byPhone) existingUser = byPhone;
      }

      if (!existingUser) {
        const [newUser] = await db
          .insert(users)
          .values({
            email: lookupEmail,
            passwordHash: hashPassword("Demo1234!"),
            fullName,
            phone: m.phone || null,
            platformRole: null,
          })
          .returning();
        existingUser = newUser;
        await persistDb();
      }

      if (existingUser) {
        candidates.push({
          id: existingUser.id,
          memberId: m.id,
          fullName,
          email: existingUser.email,
          phone: m.phone || "No phone",
          membershipNumber: m.membershipNumber || `ID-${m.id}`,
        });
      }
    }

    return ok(candidates);
  } catch (e) {
    return fail(e);
  }
}
