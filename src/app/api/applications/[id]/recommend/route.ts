import { and, eq } from "drizzle-orm";
import { db, persistDb } from "@/db";
import { membershipApplications, organizationMemberships, users, notifications } from "@/db/rh-schema";
import { requireUser, requireAccess, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * STAGE 1 of 2 — chairperson recommendation.
 * This can never approve a member: allowed target states are
 * chairperson_review, recommended, not_recommended, changes_requested.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    const appId = Number((await params).id);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireAccess(user.id, orgId);
    if (access.chairStationId === null) throw new HttpError(403, "Only station chairpersons can recommend.");

    const { decision, notes } = await body<{ decision?: string; notes?: string }>(req);
    if (!["recommended", "not_recommended", "changes_requested"].includes(decision ?? ""))
      throw new HttpError(400, "decision must be recommended, not_recommended or changes_requested.");

    const [app] = await db
      .select()
      .from(membershipApplications)
      .where(and(eq(membershipApplications.id, appId), eq(membershipApplications.orgId, orgId)));
    if (!app) throw new HttpError(404, "Application not found.");
    if (app.stationId !== access.chairStationId)
      throw new HttpError(403, "You can only act on applications for your assigned station.");
    if (!["submitted", "chairperson_review", "changes_requested"].includes(app.status))
      throw new HttpError(409, "Application is no longer in a state the chairperson can act on.");
    if (decision !== "changes_requested" && !notes?.trim())
      throw new HttpError(400, "A recommendation note is required.");

    await db.transaction(async (tx) => {
      await tx
        .update(membershipApplications)
        .set({
          status: decision as "recommended",
          chairNotes: notes ?? null,
          recommendedBy: decision === "changes_requested" ? app.recommendedBy : user.id,
          recommendedAt: decision === "changes_requested" ? app.recommendedAt : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(membershipApplications.id, appId));

      if (decision !== "changes_requested") {
        const admins = await tx
          .select({ userId: users.id })
          .from(organizationMemberships)
          .innerJoin(users, eq(organizationMemberships.userId, users.id))
          .where(and(eq(organizationMemberships.orgId, orgId), inArrayRoles()));
        for (const a of admins)
          await tx.insert(notifications).values({
            userId: a.userId,
            orgId,
            type: "application",
            title: decision === "recommended" ? "Recommendation awaiting your decision" : "Chairperson does not recommend applicant",
            body: `${app.fullName} — final approval is now yours.`,
          });
      }
    });

    await audit(user.id, orgId, `application.${decision}`, {
      entity: "application",
      entityId: appId,
      details: { applicant: app.fullName, notes },
    });
    await persistDb();
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

function inArrayRoles() {
  return (require("drizzle-orm") as typeof import("drizzle-orm")).inArray(organizationMemberships.role, ["owner", "admin"]);
}
