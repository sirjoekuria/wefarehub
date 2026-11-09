import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ---------------------------------- enums ---------------------------------- */

export const orgStatusEnum = pgEnum("org_status", ["pending", "active", "suspended", "cancelled"]);
export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "secretary", "treasurer"]);
export const stationRoleEnum = pgEnum("station_role", ["chairperson", "secretary", "deputy_chairperson"]);
export const officialStatusEnum = pgEnum("official_status", ["active", "inactive"]);
export const memberStatusEnum = pgEnum("member_status", [
  "pending", "active", "suspended", "inactive", "transferred", "deceased", "archived",
]);
export const applicationStatusEnum = pgEnum("application_status", [
  "submitted", "chairperson_review", "recommended", "not_recommended",
  "pending_final", "approved", "rejected", "changes_requested",
]);
export const transferStatusEnum = pgEnum("transfer_status", ["pending", "approved", "rejected"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "pending_payment", "active", "renewal_due", "past_due", "grace_period",
  "suspended", "cancelled", "expired",
]);
export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "annual"]);
export const paymentStatusEnum = pgEnum("rh_payment_status", ["pending", "verified", "rejected", "failed"]);
export const fieldTypeEnum = pgEnum("field_type", [
  "text", "number", "date", "dropdown", "multi", "checkbox", "phone", "file",
]);

/* ------------------------------- platform ------------------------------- */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  platformRole: text("platform_role"), // 'super_admin' | 'support' | null
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  token: varchar("token", { length: 64 }).primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  monthlyPriceKes: integer("monthly_price_kes").notNull(),
  annualPriceKes: integer("annual_price_kes").notNull(),
  maxStations: integer("max_stations").notNull(),
  maxMembers: integer("max_members").notNull(),
  maxAdmins: integer("max_admins").notNull(),
  storageMb: integer("storage_mb").notNull(),
  features: jsonb("features").$type<Record<string, boolean>>().default({}),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable(
  "rh_audit_logs",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("rh_audit_logs_org_idx").on(t.orgId, t.createdAt),
    userIdx: index("rh_audit_logs_user_idx").on(t.userId, t.createdAt),
  }),
);

/* -------------------------------- tenancy --------------------------------- */

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  code: varchar("code", { length: 12 }).notNull(),
  motto: text("motto"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#177245"),
  secondaryColor: text("secondary_color").notNull().default("#14201A"),
  accentColor: text("accent_color").notNull().default("#F5B301"),
  county: text("county"),
  location: text("location"),
  phone: text("phone"),
  email: text("email"),
  registrationNumber: text("registration_number"),
  description: text("description"),
  status: orgStatusEnum("status").notNull().default("pending"),
  formVersion: integer("form_version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("admin"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqOrgUser: unique("om_org_user_uniq").on(t.orgId, t.userId),
  }),
);

export const organizationSubscriptions = pgTable(
  "organization_subscriptions",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    planId: integer("plan_id").notNull().references(() => subscriptionPlans.id),
    status: subscriptionStatusEnum("status").notNull().default("pending_payment"),
    billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
    currentPeriodStart: date("current_period_start"),
    currentPeriodEnd: date("current_period_end"),
    cancelledAt: timestamp("cancelled_at"),
    cancellationReason: text("cancellation_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("subs_org_idx").on(t.orgId, t.createdAt),
  }),
);

export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: integer("subscription_id").references(() => organizationSubscriptions.id, {
      onDelete: "set null",
    }),
    method: text("method").notNull().default("manual_bank"),
    mpesaRef: varchar("mpesa_ref", { length: 64 }),
    amountKes: integer("amount_kes").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("pay_org_idx").on(t.orgId, t.createdAt),
    mpesaIdx: uniqueIndex("pay_mpesa_ref_uniq").on(t.mpesaRef),
  }),
);

/* ----------------------------- stations & staff ---------------------------- */

export const pickupStations = pgTable(
  "pickup_stations",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: varchar("code", { length: 40 }).notNull(),
    location: text("location"),
    description: text("description"),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("stations_org_idx").on(t.orgId),
    uniqOrgCode: unique("stations_org_code_uniq").on(t.orgId, t.code),
  }),
);

export const stationOfficials = pgTable(
  "station_officials",
  {
    id: serial("id").primaryKey(),
    stationId: integer("station_id").notNull().references(() => pickupStations.id, {
      onDelete: "cascade",
    }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: stationRoleEnum("role").notNull(),
    status: officialStatusEnum("status").notNull().default("active"),
    note: text("note"),
    appointedAt: timestamp("appointed_at").defaultNow().notNull(),
  },
  (t) => ({
    stationIdx: index("soff_station_idx").on(t.stationId),
    // At most ONE active chairperson per station — enforced in the database.
    oneActiveChair: uniqueIndex("soff_one_active_chair").on(t.stationId).where(
      sql`"role" = 'chairperson' AND "status" = 'active'`,
    ),
  }),
);

/* ----------------------------- membership core ----------------------------- */

export const members = pgTable(
  "rh_members",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    stationId: integer("station_id").notNull().references(() => pickupStations.id),
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    surname: text("surname").notNull(),
    phone: text("phone"),
    altPhone: text("alt_phone"),
    email: text("email"),
    area: text("area"),
    dob: date("dob"),
    gender: text("gender"),
    nationalId: text("national_id"),
    photoUrl: text("photo_url"),
    /* identity verification (captured at registration) */
    idImageUrl: text("id_image_url"),
    idType: text("id_type"), // national_id | driving_licence | passport
    idNumber: text("id_number"),
    idName: text("id_name"),
    idDob: date("id_dob"),
    idGender: text("id_gender"),
    idIssuedAt: date("id_issued_at"),
    idExpiryAt: date("id_expiry_at"),
    bikeRegNo: text("bike_reg_no"),
    bikeModel: text("bike_model"),
    bikeOwnership: text("bike_ownership"),
    membershipNumber: text("membership_number"),
    existingQrId: text("existing_qr_id"),
    status: memberStatusEnum("status").notNull().default("active"),
    source: text("source").notNull().default("online"),
    registrationDate: date("registration_date"),
    approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("rh_members_org_idx").on(t.orgId, t.status),
    stationIdx: index("rh_members_station_idx").on(t.stationId),
    phoneIdx: index("rh_members_org_phone_idx").on(t.orgId, t.phone),
    uniqOrgNumber: unique("rh_members_org_number_uniq").on(t.orgId, t.membershipNumber),
  }),
);

export const memberCustomFieldDefinitions = pgTable(
  "member_custom_field_definitions",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 80 }).notNull(),
    label: text("label").notNull(),
    type: fieldTypeEnum("type").notNull().default("text"),
    options: jsonb("options").$type<string[]>(),
    required: boolean("required").default(false).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    position: integer("position").notNull().default(0),
    visibility: text("visibility").notNull().default("registration"), // 'registration' | 'admin'
    helpText: text("help_text"),
    formVersion: integer("form_version").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("fdefs_org_idx").on(t.orgId, t.position),
    uniqOrgKey: unique("fdefs_org_key_uniq").on(t.orgId, t.key),
  }),
);

export const memberCustomFieldValues = pgTable(
  "member_custom_field_values",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    fieldId: integer("field_id").notNull().references(() => memberCustomFieldDefinitions.id, {
      onDelete: "cascade",
    }),
    valueText: text("value_text"),
    valueNumber: doublePrecision("value_number"),
    valueDate: date("value_date"),
    valueJson: jsonb("value_json").$type<unknown>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqMemberField: unique("fvals_member_field_uniq").on(t.memberId, t.fieldId),
  }),
);

/* --------------------------- registration & approval ----------------------- */

export const registrationInvitations = pgTable(
  "registration_invitations",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    stationId: integer("station_id").notNull().references(() => pickupStations.id, {
      onDelete: "cascade",
    }),
    token: varchar("token", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    maxUses: integer("max_uses").notNull().default(100),
    usesCount: integer("uses_count").notNull().default(0),
    isRevoked: boolean("is_revoked").default(false).notNull(),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    stationIdx: index("inv_station_idx").on(t.stationId),
  }),
);

export const membershipApplications = pgTable(
  "membership_applications",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    stationId: integer("station_id").notNull().references(() => pickupStations.id),
    invitationId: integer("invitation_id").references(() => registrationInvitations.id, {
      onDelete: "set null",
    }),
    formVersion: integer("form_version").notNull().default(1),
    status: applicationStatusEnum("status").notNull().default("submitted"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    area: text("area"),
    chairNotes: text("chair_notes"),
    recommendedBy: integer("recommended_by").references(() => users.id, { onDelete: "set null" }),
    recommendedAt: timestamp("recommended_at"),
    decisionBy: integer("decision_by").references(() => users.id, { onDelete: "set null" }),
    decisionAt: timestamp("decision_at"),
    decisionNotes: text("decision_notes"),
    rejectionReason: text("rejection_reason"),
    memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("apps_org_idx").on(t.orgId, t.status),
    stationIdx: index("apps_station_idx").on(t.stationId, t.status),
  }),
);

/* ---------------------------- transfers & cards ---------------------------- */

export const membershipTransfers = pgTable(
  "membership_transfers",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    fromStationId: integer("from_station_id").notNull().references(() => pickupStations.id),
    toStationId: integer("to_station_id").notNull().references(() => pickupStations.id),
    reason: text("reason").notNull(),
    requestedBy: integer("requested_by").references(() => users.id, { onDelete: "set null" }),
    status: transferStatusEnum("status").notNull().default("pending"),
    approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("transfers_org_idx").on(t.orgId),
    memberIdx: index("transfers_member_idx").on(t.memberId),
  }),
);

export const membershipCards = pgTable(
  "membership_cards",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    memberId: integer("member_id").notNull().unique().references(() => members.id, {
      onDelete: "cascade",
    }),
    qrPayload: text("qr_payload").notNull(),
    version: integer("version").notNull().default(1),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("cards_org_idx").on(t.orgId),
  }),
);

/* ---------------------------------- comms ---------------------------------- */

export const announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    stationId: integer("station_id").references(() => pickupStations.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    author: text("author"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("ann_org_idx").on(t.orgId, t.createdAt),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orgId: integer("org_id"),
    type: text("type").notNull().default("info"),
    title: text("title").notNull(),
    body: text("body"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("notif_user_idx").on(t.userId, t.createdAt),
  }),
);
