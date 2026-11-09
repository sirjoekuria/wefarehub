import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { memberCustomFieldDefinitions, organizations } from "@/db/rh-schema";
import { requireUser, requireOrgRole, assertEntitled, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

const TYPES = ["text", "number", "date", "dropdown", "multi", "checkbox", "phone", "file"];

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const orgId = qnum(req, "orgId");
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin", "secretary", "treasurer"]);
    void access;
    const rows = await db
      .select()
      .from(memberCustomFieldDefinitions)
      .where(eq(memberCustomFieldDefinitions.orgId, orgId))
      .orderBy(asc(memberCustomFieldDefinitions.position));
    return ok(rows);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin"]);
    await assertEntitled(orgId);

    const { label, type, options, required, visibility, helpText } = await body<{
      label?: string; type?: string; options?: string[]; required?: boolean; visibility?: string; helpText?: string;
    }>(req);
    if (!label?.trim() || !TYPES.includes(type ?? ""))
      throw new HttpError(400, "label and a valid type are required.");
    if ((type === "dropdown" || type === "multi") && (!options || options.length === 0))
      throw new HttpError(400, "Dropdown and multiple-choice fields need at least one option.");

    const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || `field_${Date.now()}`;
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const [maxRow] = await db.select({ n: sql`coalesce(max("position"), -1)::int` }).from(memberCustomFieldDefinitions).where(eq(memberCustomFieldDefinitions.orgId, orgId));

    const finalKey = await uniqueKey(key, orgId);
    const [row] = await db
      .insert(memberCustomFieldDefinitions)
      .values({
        orgId,
        key: finalKey,
        label: label.trim(),
        type: type as "text",
        options: options ?? null,
        required: Boolean(required),
        enabled: true,
        position: Number(maxRow?.n ?? -1) + 1,
        visibility: visibility === "admin" ? "admin" : "registration",
        helpText: helpText ?? null,
        formVersion: org.formVersion + 1,
      })
      .returning();
    await db.update(organizations).set({ formVersion: org.formVersion + 1 }).where(eq(organizations.id, orgId));
    await audit(user.id, orgId, "form.field_added", { entity: "field", entityId: row.id, details: { key: row.key, label: row.label } });
    return ok(row, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

async function uniqueKey(base: string, orgId: number): Promise<string> {
  let key = base;
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await db
      .select()
      .from(memberCustomFieldDefinitions)
      .where(and(eq(memberCustomFieldDefinitions.orgId, orgId), eq(memberCustomFieldDefinitions.key, key)));
    if (exists.length === 0) return key;
    key = `${base}_${i++}`;
  }
}
