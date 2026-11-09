import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, persistDb } from "@/db";
import {
  registrationInvitations, organizations, pickupStations, memberCustomFieldDefinitions,
} from "@/db/rh-schema";
import { JoinForm } from "./JoinForm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export default async function JoinPage({ params }: Params) {
  const { token } = await params;
  let [inv] = await db.select().from(registrationInvitations).where(eq(registrationInvitations.token, token));

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

  if (!inv || inv.isRevoked || inv.expiresAt.getTime() < Date.now() || inv.usesCount >= inv.maxUses) {
    return (
      <Shell>
        <div className="rh-card p-8 text-center max-w-md mx-auto mt-16">
          <div className="font-display text-[20px] font-bold">Registration link unavailable</div>
          <p className="mt-2 text-[13.5px] text-[var(--ink-soft)]">
            This invitation is expired, revoked or has reached its usage limit. Please contact your
            station chairperson for a new link.
          </p>
        </div>
      </Shell>
    );
  }

  const [org] = await db.select().from(organizations).where(eq(organizations.id, inv.orgId));
  const [station] = await db.select().from(pickupStations).where(eq(pickupStations.id, inv.stationId));
  if (!org || !station || org.status !== "active") notFound();

  const fields = await db
    .select()
    .from(memberCustomFieldDefinitions)
    .where(and(eq(memberCustomFieldDefinitions.orgId, org.id), eq(memberCustomFieldDefinitions.enabled, true)))
    .orderBy(asc(memberCustomFieldDefinitions.position));

  const regFields = fields.filter((f) => f.visibility === "registration");

  return (
    <Shell
      primary={org.primaryColor}
      secondary={org.secondaryColor}
      accent={org.accentColor}
      logoUrl={org.logoUrl}
      orgName={org.name}
      motto={org.motto}
    >
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <span
            className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-white text-[15px]"
            style={{ background: org.primaryColor }}
          >
            {org.code}
          </span>
          <div>
            <div className="font-display font-bold text-[18px]">{org.name}</div>
            <div className="text-[12px] font-semibold text-[var(--ink-faint)]">{org.motto}</div>
          </div>
        </div>

        <div className="rh-card p-6">
          <h1 className="font-display text-[21px] font-bold">Join the {station.name} register</h1>
          <p className="mt-1.5 text-[13.5px] text-[var(--ink-soft)] leading-relaxed">
            Complete your application below. It will be <b>reviewed by the station chairperson</b>, who
            records a recommendation; an <b>association administrator</b> makes the final decision.
            Approved members receive a membership number and digital card.
          </p>

          <JoinForm
            token={token}
            orgId={org.id}
            formVersion={org.formVersion}
            fields={regFields.map((f) => ({
              id: f.id,
              label: f.label,
              type: f.type,
              required: f.required,
              options: f.options,
              helpText: f.helpText,
            }))}
            stationName={station.name}
          />
        </div>

        <p className="mt-4 text-[11.5px] text-[var(--ink-faint)] leading-relaxed max-w-xl">
          Data protection notice: your details are processed for membership administration of {org.name}
          (Kenya Data Protection Act, 2019). Fields marked * are required. You may request correction or
          deletion of your data through the association.
        </p>
      </div>
    </Shell>
  );
}

function Shell({
  primary, secondary, accent, logoUrl, orgName, motto, children,
}: {
  primary?: string; secondary?: string; accent?: string; logoUrl?: string | null;
  orgName?: string; motto?: string | null; children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-[var(--paper)]"
      style={{
        ["--org-primary" as never]: primary,
        ["--org-secondary" as never]: secondary,
        ["--org-accent" as never]: accent,
      }}
    >
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${primary ?? "var(--pine)"}, ${accent ?? "var(--amber)"})` }} />
      <header className="bg-white border-b border-[var(--line)]">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={orgName ?? "logo"} className="w-12 h-12 rounded-xl object-cover border border-[var(--line)] shadow-sm" />
          ) : (
            <span className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-[15px] shadow-sm" style={{ background: primary ?? "var(--pine)" }}>
              {orgName?.slice(0, 3).toUpperCase() ?? "RH"}
            </span>
          )}
            <div className="leading-none">
              <div className="font-display font-bold text-[14px]">{orgName ?? "RiderHub 360"}</div>
              <div className="text-[10px] font-semibold text-[var(--ink-faint)] uppercase tracking-[0.1em]">Member registration</div>
            </div>
          </div>
          {motto ? <div className="text-[11.5px] font-semibold text-[var(--ink-faint)] hidden sm:block">“{motto}”</div> : null}
        </div>
      </header>
      <div className="px-5 py-8">{children}</div>
    </div>
  );
}
