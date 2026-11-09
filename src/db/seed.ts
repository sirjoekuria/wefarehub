/* RIDERHUB 360 — Clean SaaS initial seed.
 * Hardcodes Joseph Kuria as super_admin and provisions default subscription tiers.
 */
import { db } from "./index";
import {
  users, sessions, subscriptionPlans, auditLogs, organizations, organizationMemberships,
  organizationSubscriptions, subscriptionPayments, pickupStations, stationOfficials,
  members, memberCustomFieldDefinitions, memberCustomFieldValues, membershipApplications,
  registrationInvitations, membershipTransfers, membershipCards, announcements, notifications,
} from "./rh-schema";
import { hashPassword } from "../lib/password";

const ADMIN_PASSWORD = hashPassword("December25J#");

async function wipe() {
  for (const t of [
    notifications, announcements, membershipCards, membershipTransfers,
    membershipApplications, memberCustomFieldValues, memberCustomFieldDefinitions,
    registrationInvitations, stationOfficials, members, pickupStations,
    subscriptionPayments, organizationSubscriptions, organizationMemberships,
    organizations, auditLogs, sessions, subscriptionPlans, users,
  ]) {
    try {
      await db.delete(t);
    } catch {
      // ignore
    }
  }
}

/** Clean SaaS initial seed: hardcoded Super Admin and subscription tiers. */
export async function seedPilotData() {
  await wipe();

  /* ------------------------------ super admin ------------------------------ */
  await db.insert(users).values([
    {
      email: "kuriajoe85@gmail.com",
      passwordHash: ADMIN_PASSWORD,
      fullName: "Joseph Kuria",
      platformRole: "super_admin",
      phone: "254700898950",
    },
  ]);

  /* ------------------------------ subscription plans ------------------------------ */
  const planSeeds: typeof subscriptionPlans.$inferInsert[] = [
    { code: "starter", name: "Starter", description: "Small associations getting started (up to 3 stations, 100 members)", monthlyPriceKes: 1500, annualPriceKes: 15000, maxStations: 3, maxMembers: 100, maxAdmins: 2, storageMb: 100, sortOrder: 1 },
    { code: "growth", name: "Growth", description: "Growing associations with multiple stations (up to 10 stations, 500 members)", monthlyPriceKes: 3500, annualPriceKes: 35000, maxStations: 10, maxMembers: 500, maxAdmins: 5, storageMb: 500, sortOrder: 2 },
    { code: "professional", name: "Professional", description: "Large associations with full reporting (up to 25 stations, 2,000 members)", monthlyPriceKes: 7500, annualPriceKes: 75000, maxStations: 25, maxMembers: 2000, maxAdmins: 10, storageMb: 2048, sortOrder: 3 },
    { code: "enterprise", name: "Enterprise", description: "Multi-constituency federations & county unions", monthlyPriceKes: 15000, annualPriceKes: 150000, maxStations: 200, maxMembers: 20000, maxAdmins: 50, storageMb: 10240, sortOrder: 4 },
  ];
  await db.insert(subscriptionPlans).values(planSeeds);
}

// CLI entrypoint only (npx tsx src/db/seed.ts); server bootstrap imports seedPilotData directly
const isCli = typeof process.argv[1] === "string" && process.argv[1].includes("seed.ts");
if (isCli) {
  seedPilotData()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => process.exit());
}
