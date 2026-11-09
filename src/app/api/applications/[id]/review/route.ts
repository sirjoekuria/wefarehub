import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { membershipApplications, pickupStations } from "@/db/rh-schema";
import { requireUser, requireAccess, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Chairperson opens an application for review (submitted → chairperson_review). */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    const appId = Number((await params).id);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireAccess(user.id, orgId);
    if (access.chairStationId === null) throw new HttpError(403, "Only station chairpersons can review applications.");

    const [app] = await db
      .select()
      .from(membershipApplications)
      .where(and(eq(membershipApplications.id, appId), eq(membershipApplications.orgId, orgId)));
    if (!app) throw new HttpError(404, "Application not found.");
    if (app.stationId !== access.chairStationId)
      throw new HttpError(403, "You can only review applications for your assigned station.");
    if (app.status !== "submitted") throw new HttpError(409, "Application is not in a reviewable state.");

    await db
      .update(membershipApplications)
      .set({ status: "chairperson_review", updatedAt: new Date() })
      .where(eq(membershipApplications.id, appId));
    await audit(user.id, orgId, "application.review_started", { entity: "application", entityId: appId, details: { applicant: app.fullName } });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
