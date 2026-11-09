import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberCustomFieldDefinitions, organizations } from "@/db/rh-schema";
import { requireUser, requireOrgRole, assertEntitled, audit, HttpError } from "@/lib/authz";
import { fail, ok, qnum, body, orgIdOf } from "@/lib/rh-api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const TYPES = ["text", "number", "date", "dropdown", "multi", "checkbox", "phone", "file"];

/** Edit a field. Disabling never deletes stored values (enabled=false). */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const orgId = await orgIdOf(req);
    const fieldId = Number((await params).id);
    if (!orgId) throw new HttpError(400, "orgId is required.");
    const access = await requireOrgRole(user.id, orgId, ["owner", "admin"]);
    await assertEntitled(orgId);

    const [def] = await db
      .select()
      .from(memberCustomFieldDefinitions)
      .where(and(eq(memberCustomFieldDefinitions.id, fieldId), eq(memberCustomFieldDefinitions.orgId, orgId)));
    if (!def) throw new HttpError(404, "Field not found in this workspace.");

    const b = await body<Record<string, unknown>>(req);
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof b.label === "string" && b.label.trim()) set.label = b.label.trim();
    if (typeof b.type === "string") {
      if (!TYPES.includes(b.type)) throw new HttpError(400, "Invalid field type.");
      set.type = b.type;
    }
    if ("options" in b) set.options = Array.isArray(b.options) ? (b.options as string[]).map(String) : null;
    if ("required" in b) set.required = Boolean(b.required);
    if ("enabled" in b) set.enabled = Boolean(b.enabled);
    if ("visibility" in b) set.visibility = b.visibility === "admin" ? "admin" : "registration";
    if ("helpText" in b) set.helpText = b.helpText ? String(b.helpText) : null;

    if (set.type === "dropdown" || set.type === "multi" || (set.type && (set.type === "dropdown" || set.type === "multi"))) {
      const opts = (set.options ?? def.options ?? []) as string[];
      if (opts.length === 0) throw new HttpError(400, "Dropdown/multiple-choice fields need options.");
    }

    if (Object.keys(set).length <= 1) throw new HttpError(400, "Nothing to update.");

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    await db.update(memberCustomFieldDefinitions).set(set as never).where(eq(memberCustomFieldDefinitions.id, fieldId));
    await db.update(organizations).set({ formVersion: org.formVersion + 1 }).where(eq(organizations.id, orgId));
    await audit(user.id, orgId, "form.field_updated", {
      entity: "field",
      entityId: fieldId,
      details: { key: def.key, fields: Object.keys(set).filter((k) => k !== "updatedAt"), enabled: set.enabled },
    });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
