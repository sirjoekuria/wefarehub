import { and, eq, sql } from "drizzle-orm";
import { db, persistDb } from "@/db";
import {
  registrationInvitations, organizations, pickupStations, memberCustomFieldDefinitions,
  membershipApplications, stationOfficials, users, notifications,
} from "@/db/rh-schema";
import { assertEntitled, audit, HttpError } from "@/lib/authz";
import { fail, ok, body } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/**
 * Public registration submission. The token is the only input; organization
 * and station are resolved server-side. Client-supplied org/station ids are
 * ignored by construction.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const token = (await params).token;
    let [inv] = await db
      .select()
      .from(registrationInvitations)
      .where(eq(registrationInvitations.token, token));

    if (!inv) {
      const [st] = await db
        .select()
        .from(pickupStations)
        .where(sql`lower(${pickupStations.code}) = lower(${token})`)
        .limit(1);

      if (st) {
        const [existing] = await db
          .select()
          .from(registrationInvitations)
          .where(
            and(
              eq(registrationInvitations.stationId, st.id),
              eq(registrationInvitations.isRevoked, false),
            ),
          )
          .limit(1);

        if (existing) {
          inv = existing;
        } else {
          const [created] = await db
            .insert(registrationInvitations)
            .values({
              orgId: st.orgId,
              stationId: st.id,
              token: st.code.toLowerCase(),
              expiresAt: new Date(Date.now() + 365 * 86400000),
              maxUses: 1000,
            })
            .returning();
          inv = created;
          await persistDb();
        }
      }
    }
    // intentionally identical failure for every invalid-token class (no oracle)
    if (!inv || inv.isRevoked || inv.expiresAt.getTime() < Date.now() || inv.usesCount >= inv.maxUses)
      throw new HttpError(410, "This registration link is not available.");

    const [org] = await db.select().from(organizations).where(eq(organizations.id, inv.orgId));
    const [station] = await db.select().from(pickupStations).where(eq(pickupStations.id, inv.stationId));
    if (!org || !station || station.orgId !== org.id || org.status !== "active")
      throw new HttpError(410, "This registration link is not available.");

    await assertEntitled(org.id);

    const d = (await body<Record<string, any>>(req)) ?? {};
    const firstName = String(d.firstName ?? "").trim();
    const surname = String(d.surname ?? "").trim();
    const phone = String(d.phone ?? "").trim();
    const fullName = `${firstName} ${surname}`.trim();
    if (!firstName || !surname || !phone)
      throw new HttpError(400, "First name, surname and phone number are required.");
    if (!d.consent) throw new HttpError(400, "Consent to data processing is required.");

    // ---- photo & identity verification (required) ----
    const assertImage = (v: unknown, label: string) => {
      const s = typeof v === "string" ? v : "";
      if (!s.startsWith("data:image/")) throw new HttpError(400, `${label} is required.`);
      if (s.length > 4_500_000) throw new HttpError(400, `${label} is too large — maximum 3MB.`);
      return s;
    };
    const photoData = assertImage(d.photo, "Passport photo");
    const idImageData = assertImage(d.idImage, "ID card / driving licence photo");
    const idDoc = d.id ?? {};
    const idType = String(idDoc.type ?? "");
    const idNumber = String(idDoc.number ?? "").trim();
    const idName = String(idDoc.name ?? "").trim();
    const idDob = String(idDoc.dob ?? "").slice(0, 10);
    const idGender = String(idDoc.gender ?? "");
    if (!["national_id", "driving_licence", "passport"].includes(idType))
      throw new HttpError(400, "A valid ID type is required.");
    if (!idNumber || !idName || !idDob || !idGender)
      throw new HttpError(400, "ID number, full name, date of birth and gender are required.");
    const idExpiry = String(idDoc.expiryAt ?? "").slice(0, 10) || null;
    const idIssued = String(idDoc.issuedAt ?? "").slice(0, 10) || null;

    // server-side validation of required custom fields
    const defs = await db
      .select()
      .from(memberCustomFieldDefinitions)
      .where(and(eq(memberCustomFieldDefinitions.orgId, org.id), eq(memberCustomFieldDefinitions.enabled, true)))
      .orderBy(memberCustomFieldDefinitions.position);
    const custom: Record<string, unknown> = {};
    for (const def of defs) {
      const v = (d.custom ?? {})[String(def.id)] ?? (d.custom as Record<string, unknown> | undefined)?.[def.id as never];
      if (def.required && (v == null || v === "" || (Array.isArray(v) && v.length === 0)))
        throw new HttpError(400, `The field “${def.label}” is required.`);
      if (v != null && v !== "") {
        if (def.type === "dropdown" && def.options && !def.options.includes(String(v)))
          throw new HttpError(400, `Invalid value for “${def.label}”.`);
        if (def.type === "number" && Number.isNaN(Number(v)))
          throw new HttpError(400, `“${def.label}” must be a number.`);
        custom[String(def.id)] = v;
      }
    }

    const data = {
      firstName,
      middleName: String(d.middleName ?? "").trim() || undefined,
      surname,
      phone,
      email: d.email ? String(d.email).trim() : undefined,
      area: d.area ? String(d.area).trim() : undefined,
      dob: d.dob ? String(d.dob).slice(0, 10) : idDob,
      gender: d.gender ? String(d.gender) : idGender,
      nationalId: idType === "national_id" ? idNumber : d.nationalId ? String(d.nationalId).trim() : undefined,
      bikeRegNo: d.bikeRegNo ? String(d.bikeRegNo).trim() : undefined,
      bikeModel: d.bikeModel ? String(d.bikeModel).trim() : undefined,
      bikeOwnership: d.bikeOwnership ? String(d.bikeOwnership) : undefined,
      existingQrId: d.existingQrId ? String(d.existingQrId).trim() : undefined,
      photo: photoData,
      idImage: idImageData,
      id: { type: idType, number: idNumber, name: idName, dob: idDob, gender: idGender, issuedAt: idIssued, expiryAt: idExpiry },
      consentAt: new Date().toISOString(),
      custom,
    };

    const app = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(membershipApplications)
        .values({
          orgId: org.id,
          stationId: station.id,
          invitationId: inv.id,
          formVersion: org.formVersion,
          status: "submitted",
          data,
          fullName,
          phone,
          email: d.email ? String(d.email).trim() : null,
          area: d.area ? String(d.area).trim() : null,
          createdAt: new Date(),
        })
        .returning();
      await tx
        .update(registrationInvitations)
        .set({ usesCount: inv.usesCount + 1 })
        .where(eq(registrationInvitations.id, inv.id));

      const chairs = await tx
        .select({ userId: users.id })
        .from(stationOfficials)
        .innerJoin(users, eq(stationOfficials.userId, users.id))
        .where(
          and(
            eq(stationOfficials.stationId, station.id),
            eq(stationOfficials.role, "chairperson"),
            eq(stationOfficials.status, "active"),
          ),
        );
      for (const c of chairs)
        await tx.insert(notifications).values({
          userId: c.userId,
          orgId: org.id,
          type: "application",
          title: `New application at ${station.name}`,
          body: `${fullName} is waiting for your review.`,
        });
      return row;
    });

    await audit(null, org.id, "application.submitted", {
      entity: "application",
      entityId: app.id,
      details: { applicant: fullName, station: station.name, formVersion: org.formVersion },
    });
    await persistDb();
    return ok({ ok: true, id: app.id }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
