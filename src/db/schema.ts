import { pgTable, pgEnum, uuid, text, boolean, timestamp, numeric, unique, index, check, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const caseType = pgEnum('case_type', ['hospital', 'death']);
export const caseStatus = pgEnum('case_status', ['open', 'closed']);

export const paymentStatus = pgEnum('payment_status', ['matched', 'unmatched']);

export const pickupPoints = pgTable('pickup_points', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [check('pickup_code_format', sql`${table.code} ~ '^[A-Z][A-Z0-9]{1,15}$'`)]);

export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  pickupPointId: uuid('pickup_point_id').notNull().references(() => pickupPoints.id, { onDelete: 'restrict' }),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  qrNumber: text('qr_number').notNull(),
  idNumber: text('id_number'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('members_pickup_qr_unique').on(table.pickupPointId, table.qrNumber),
  index('members_pickup_idx').on(table.pickupPointId),
  check('member_qr_format', sql`${table.qrNumber} ~ '^[0-9]{1,12}$'`),
  check('member_phone_format', sql`${table.phone} ~ '^254(7|1)[0-9]{8}$'`),
]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  mpesaReceipt: text('mpesa_receipt').notNull().unique(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  payerPhone: text('payer_phone').notNull(),
  billRefRaw: text('bill_ref_raw').notNull(),
  pickupCodeParsed: text('pickup_code_parsed'),
  qrParsed: text('qr_parsed'),
  memberId: uuid('member_id').references(() => members.id, { onDelete: 'restrict' }),
  status: paymentStatus('status').notNull().default('unmatched'),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('payments_paid_at_idx').on(table.paidAt),
  index('payments_status_idx').on(table.status),
  index('payments_member_idx').on(table.memberId),
  check('payment_amount_positive', sql`${table.amount} > 0`),
  check('payment_match_consistency', sql`(${table.status} = 'matched' AND ${table.memberId} IS NOT NULL) OR (${table.status} = 'unmatched' AND ${table.memberId} IS NULL)`),
]);

export const welfareCases = pgTable('welfare_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'restrict' }),
  caseType: caseType('case_type').notNull(),
  status: caseStatus('status').notNull().default('open'),
  description: text('description'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('welfare_cases_status_idx').on(table.status),
  index('welfare_cases_member_idx').on(table.memberId),
]);

// Only used by the explicitly enabled, local demonstration adapter.
// Supabase deployments use auth.users and never this table.
export const demoAdmins = pgTable('demo_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),
  actorEmail: text('actor_email').notNull().default('system'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  entityName: text('entity_name'),
  details: jsonb('details').notNull().default({}),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_logs_created_at_idx').on(table.createdAt),
  index('audit_logs_action_idx').on(table.action),
  index('audit_logs_entity_type_idx').on(table.entityType),
  index('audit_logs_actor_email_idx').on(table.actorEmail),
]);
