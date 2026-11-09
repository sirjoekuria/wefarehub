import { and, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { members, pickupStations } from "@/db/rh-schema";
import { requireUser, requireAccess, assertEntitled, HttpError } from "@/lib/authz";
import { fail, csv, qnum } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireAccess(user.id, orgId);
    await assertEntitled(orgId);

    const conds: SQL[] = [eq(members.orgId, orgId)];
    if (access.orgRole === null && access.chairStationId !== null)
      conds.push(eq(members.stationId, access.chairStationId!));

    const rows = await db
      .select({
        number: members.membershipNumber,
        first: members.firstName,
        middle: members.middleName,
        last: members.surname,
        phone: members.phone,
        area: members.area,
        station: pickupStations.name,
        status: members.status,
        registered: members.registrationDate,
        bike: members.bikeRegNo,
        source: members.source,
      })
      .from(members)
      .innerJoin(pickupStations, eq(members.stationId, pickupStations.id))
      .where(and(...conds))
      .orderBy(members.membershipNumber);

    const csvText = csv(
      [
        { header: "Membership No", value: (r) => r.number },
        { header: "First name", value: (r) => r.first },
        { header: "Middle name", value: (r) => r.middle },
        { header: "Surname", value: (r) => r.last },
        { header: "Phone", value: (r) => r.phone },
        { header: "Area", value: (r) => r.area },
        { header: "Station", value: (r) => r.station },
        { header: "Status", value: (r) => r.status },
        { header: "Registered", value: (r) => r.registered },
        { header: "Bike reg", value: (r) => r.bike },
        { header: "Source", value: (r) => r.source },
      ],
      rows as unknown as Record<string, unknown>[],
    );
    return new Response(csvText, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="members-register-${orgId}.csv"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
