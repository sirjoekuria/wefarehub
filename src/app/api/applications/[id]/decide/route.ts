import { and, eq, sql } from "drizzle-orm";
import { db, persistDb } from "@/db";
import {
  membershipApplications, members, membershipCards, organizations, notifications,
} from "@/db/rh-schema";
import { requireUser, requireOrgRole, assertEntitled, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * STAGE 2 of 2 — final association decision. Owner/admin ONLY.
 * Approval transaction: membership number + member row + card + link, atomically.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    const appId = Number((await params).id);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin"]);
    await assertEntitled(orgId);

    const { decision, notes, rejectionReason } = await body<{ decision?: string; notes?: string; rejectionReason?: string }>(req);
    if (!["approved", "rejected"].includes(decision ?? ""))
      throw new HttpError(400, "decision must be approved or rejected.");
    if (decision === "rejected" && !rejectionReason?.trim())
      throw new HttpError(400, "A rejection reason is required.");

    const [app] = await db
      .select()
      .from(membershipApplications)
      .where(and(eq(membershipApplications.id, appId), eq(membershipApplications.orgId, orgId)));
    if (!app) throw new HttpError(404, "Application not found.");
    if (!["submitted", "chairperson_review", "recommended", "not_recommended", "pending_final"].includes(app.status))
      throw new HttpError(409, "Application has already been decided.");

    if (decision === "rejected") {
      await db
        .update(membershipApplications)
        .set({
          status: "rejected",
          decisionBy: user.id,
          decisionAt: new Date(),
          decisionNotes: notes ?? null,
          rejectionReason: rejectionReason!.trim(),
          updatedAt: new Date(),
        })
        .where(eq(membershipApplications.id, appId));
      await audit(user.id, orgId, "application.rejected", {
        entity: "application",
        entityId: appId,
        details: { applicant: app.fullName, reason: rejectionReason },
      });
      await persistDb();
      return ok({ ok: true });
    }

    /* -------- approval: single transaction -------- */
    try {
      await db.transaction(async (tx) => {
        const org = await tx.select().from(organizations).where(eq(organizations.id, orgId)).then((r) => r[0]);
        const [c] = await tx.select({ n: sql`count(*)::int` }).from(members).where(eq(members.orgId, orgId));
        const next = Number(c?.n ?? 0) + 1;
        const number = `${org.code}-${String(next).padStart(4, "0")}`;

        const d = (app.data ?? {}) as Record<string, any>;
        const idDoc = d.id ?? {};
        const [member] = await tx
          .insert(members)
          .values({
            orgId,
            stationId: app.stationId,
            firstName: String(d.firstName ?? app.fullName.split(" ")[0] ?? "Applicant"),
            middleName: d.middleName ? String(d.middleName) : null,
            surname: String(d.surname ?? app.fullName.split(" ").slice(-1)[0] ?? ""),
            phone: d.phone ? String(d.phone) : app.phone,
            email: d.email ? String(d.email) : app.email,
            area: d.area ? String(d.area) : app.area,
            dob: d.dob ? String(d.dob).slice(0, 10) : null,
            gender: d.gender ? String(d.gender) : null,
            nationalId: d.nationalId ? String(d.nationalId) : null,
            photoUrl: typeof d.photo === "string" && d.photo.startsWith("data:image/") ? d.photo : null,
            idImageUrl: typeof d.idImage === "string" && d.idImage.startsWith("data:image/") ? d.idImage : null,
            idType: idDoc.type ? String(idDoc.type) : null,
            idNumber: idDoc.number ? String(idDoc.number) : null,
            idName: idDoc.name ? String(idDoc.name) : null,
            idDob: idDoc.dob ? String(idDoc.dob).slice(0, 10) : null,
            idGender: idDoc.gender ? String(idDoc.gender) : null,
            idIssuedAt: idDoc.issuedAt ? String(idDoc.issuedAt).slice(0, 10) : null,
            idExpiryAt: idDoc.expiryAt ? String(idDoc.expiryAt).slice(0, 10) : null,
            bikeRegNo: d.bikeRegNo ? String(d.bikeRegNo) : null,
            bikeModel: d.bikeModel ? String(d.bikeModel) : null,
            bikeOwnership: d.bikeOwnership ? String(d.bikeOwnership) : null,
            membershipNumber: number,
            existingQrId: d.existingQrId ? String(d.existingQrId) : null,
            status: "active",
            source: "online",
            registrationDate: new Date().toISOString().slice(0, 10),
            approvedBy: user.id,
            approvedAt: new Date(),
          })
          .returning();

        // custom field values (validated at submit time)
        const custom = (d.custom ?? {}) as Record<string, unknown>;
        const entries = Object.entries(custom).filter(([, v]) => v != null && v !== "");
        if (entries.length > 0) {
          const { memberCustomFieldValues, memberCustomFieldDefinitions } = await import("@/db/rh-schema");
          for (const [fieldIdStr, value] of entries) {
            const fieldId = Number(fieldIdStr);
            if (!Number.isFinite(fieldId)) continue;
            const [def] = await tx.select().from(memberCustomFieldDefinitions).where(eq(memberCustomFieldDefinitions.id, fieldId));
            if (!def || def.orgId !== orgId) continue;
            const isNum = typeof value === "number";
            const isDate = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
            await tx.insert(memberCustomFieldValues).values({
              memberId: member.id,
              fieldId,
              valueText: isNum || isDate ? null : String(value),
              valueNumber: isNum ? Number(value) : null,
              valueDate: isDate ? value : null,
            });
          }
        }

        await tx.insert(membershipCards).values({
          orgId,
          memberId: member.id,
          qrPayload: `https://welfare-delta-nine.vercel.app/verify/${number}`,
        });

        await tx
          .update(membershipApplications)
          .set({
            status: "approved",
            memberId: member.id,
            decisionBy: user.id,
            decisionAt: new Date(),
            decisionNotes: notes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(membershipApplications.id, appId));

        // notify the applicant via the chair station's register (no email in sandbox)
        await tx.insert(notifications).values({
          userId: user.id,
          orgId,
          type: "member",
          title: `Member approved — ${number}`,
          body: `${app.fullName} added to the register.`,
        });
      });
      await audit(user.id, orgId, "application.approved", { entity: "application", entityId: appId, details: { applicant: app.fullName } });
      await persistDb();
      return ok({ ok: true });
    } catch (e) {
      if (e instanceof Error && /members_org_number_uniq|unique/i.test(e.message))
        throw new HttpError(409, "Membership number collision — retry approval.");
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}
