import { and, or, eq, ilike, asc, desc, sql, count, sum, gte, lt } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '@/db';
import { pickupPoints, members, payments, welfareCases } from '@/db/schema';
import { ApiError } from './auth';
import { today, validDateRange, validFilterDates } from './utils';
import { validatePoint, validateMember, validateImport } from './validation';
import type { Filters, ImportRow, Report, ReportRow } from './types';

const startOf = (date: string) => new Date(`${date}T00:00:00+03:00`);
const endOf = (date: string) => new Date(startOf(date).getTime() + 86400000);
const uuid = (id: unknown) => { const s = String(id || ''); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) throw new ApiError('The selected record was not found.'); return s; };
const pointSelection = { id: pickupPoints.id, code: pickupPoints.code, name: pickupPoints.name, is_active: pickupPoints.isActive, created_at: pickupPoints.createdAt };
const memberSelection = { id: members.id, pickup_point_id: members.pickupPointId, full_name: members.fullName, phone: members.phone, qr_number: members.qrNumber, is_active: members.isActive, created_at: members.createdAt };
const paymentSelection = { id: payments.id, mpesa_receipt: payments.mpesaReceipt, amount: payments.amount, payer_phone: payments.payerPhone, bill_ref_raw: payments.billRefRaw, pickup_code_parsed: payments.pickupCodeParsed, qr_parsed: payments.qrParsed, member_id: payments.memberId, status: payments.status, paid_at: payments.paidAt, created_at: payments.createdAt, member_name: members.fullName, pickup_name: pickupPoints.name, pickup_code: pickupPoints.code };

export async function localDashboard(days = 14) {
  days = Math.min(90, Math.max(1, Math.floor(days)));
  const currentDay = today();
  const first = new Date(startOf(currentDay).getTime() - (days - 1) * 86400000);
  const [stats] = await db.select({ totalCollected: sum(payments.amount), totalCount: count(), todayAmount: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.paidAt} >= ${startOf(currentDay)}), 0)`, todayCount: sql<number>`(count(*) filter (where ${payments.paidAt} >= ${startOf(currentDay)}))::int`, unmatchedCount: sql<number>`(count(*) filter (where ${payments.status} = 'unmatched'))::int` }).from(payments);
  const [pointStats] = await db.select({ activePoints: sql<number>`(count(*) filter (where ${pickupPoints.isActive}))::int`, totalPoints: count() }).from(pickupPoints);
  const [memberStats] = await db.select({ activeMembers: count() }).from(members).where(eq(members.isActive, true));
  const chartResult = await db.execute(sql`select to_char(d.day_value, 'YYYY-MM-DD') as date, coalesce(p.total,0)::float as amount, coalesce(p.count,0)::int as count from generate_series((${currentDay}::date - ${days - 1}::int)::timestamp, ${currentDay}::date::timestamp, interval '1 day') d(day_value) left join (select date_trunc('day', paid_at at time zone 'Africa/Nairobi') as day_value, sum(amount) total, count(*) count from payments where paid_at >= ${first} group by 1) p on p.day_value=d.day_value order by d.day_value`);
  const recentPayments = await db.select(paymentSelection).from(payments).leftJoin(members, eq(members.id, payments.memberId)).leftJoin(pickupPoints, eq(pickupPoints.id, members.pickupPointId)).orderBy(desc(payments.paidAt)).limit(10);
  const topPoints = await db.select({ id: pickupPoints.id, code: pickupPoints.code, name: pickupPoints.name, members: sql<number>`count(distinct ${members.id})::int`, collected: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(pickupPoints).leftJoin(members, eq(members.pickupPointId, pickupPoints.id)).leftJoin(payments, eq(payments.memberId, members.id)).where(eq(pickupPoints.isActive, true)).groupBy(pickupPoints.id).orderBy(desc(sql`coalesce(sum(${payments.amount}),0)`)).limit(4);
  return { ...stats, ...pointStats, ...memberStats, totalCollected: Number(stats.totalCollected || 0), todayAmount: Number(stats.todayAmount), chart: chartResult.rows, recentPayments, topPoints };
}

export async function localList(resource: string, filters: Filters) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = resource === 'member-options' ? 40 : Math.min(100, Math.max(1, Number(filters.pageSize) || 10));
  const search = `%${(filters.search || '').trim()}%`;
  const offset = (page - 1) * pageSize;
  if (resource === 'member-keys') return db.select({ pickup_point_id: members.pickupPointId, qr_number: members.qrNumber }).from(members);
  if (resource === 'pickup-points') {
    const conditions: SQL[] = [];
    if (filters.search) conditions.push(or(ilike(pickupPoints.code, search), ilike(pickupPoints.name, search))!);
    if (filters.active === 'active') conditions.push(eq(pickupPoints.isActive, true));
    if (filters.active === 'inactive') conditions.push(eq(pickupPoints.isActive, false));
    const where = and(...conditions);
    const [total] = await db.select({ count: count() }).from(pickupPoints).where(where);
    const items = await db.select({ ...pointSelection, member_count: sql<number>`count(distinct ${members.id})::int`, total_collected: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(pickupPoints).leftJoin(members, eq(members.pickupPointId, pickupPoints.id)).leftJoin(payments, eq(payments.memberId, members.id)).where(where).groupBy(pickupPoints.id).orderBy(asc(pickupPoints.code)).limit(pageSize).offset(offset);
    return { items, total: total.count, page, pageSize };
  }
  if (resource === 'members' || resource === 'member-options') {
    const conditions: SQL[] = [];
    if (filters.point) conditions.push(eq(members.pickupPointId, filters.point));
    if (filters.search) conditions.push(or(ilike(members.fullName, search), ilike(members.phone, search), ilike(members.qrNumber, search))!);
    if (resource === 'member-options') conditions.push(eq(members.isActive, true));
    else if (filters.active === 'active') conditions.push(eq(members.isActive, true));
    else if (filters.active === 'inactive') conditions.push(eq(members.isActive, false));
    const where = and(...conditions);
    const [total] = await db.select({ count: count() }).from(members).where(where);
    const items = await db.select({ ...memberSelection, pickup_points: { code: pickupPoints.code, name: pickupPoints.name } }).from(members).innerJoin(pickupPoints, eq(pickupPoints.id, members.pickupPointId)).where(where).orderBy(asc(members.fullName)).limit(pageSize).offset(offset);
    return { items, total: total.count, page, pageSize };
  }
  if (resource === 'payments') {
    const conditions: SQL[] = [];
    if (filters.status && filters.status !== 'all') { if (!['matched', 'unmatched'].includes(filters.status)) throw new ApiError('Invalid payment status.'); conditions.push(eq(payments.status, filters.status as 'matched' | 'unmatched')); }
    if (filters.point) { const [point] = await db.select().from(pickupPoints).where(eq(pickupPoints.id, filters.point)); if (point) conditions.push(or(eq(members.pickupPointId, point.id), and(eq(payments.status, 'unmatched'), eq(payments.pickupCodeParsed, point.code)))!); }
    if (filters.search) conditions.push(or(ilike(payments.mpesaReceipt, search), ilike(payments.billRefRaw, search), ilike(members.fullName, search), ilike(payments.payerPhone, search))!);
    if (filters.from || filters.to) {
      if (!validFilterDates(filters.from, filters.to)) throw new ApiError('Choose a valid start date on or before the end date.');
      if (filters.from) conditions.push(gte(payments.paidAt, startOf(filters.from)));
      if (filters.to) conditions.push(lt(payments.paidAt, endOf(filters.to)));
    }
    const where = and(...conditions);
    const [total] = await db.select({ count: count() }).from(payments).leftJoin(members, eq(members.id, payments.memberId)).where(where);
    const items = await db.select(paymentSelection).from(payments).leftJoin(members, eq(members.id, payments.memberId)).leftJoin(pickupPoints, eq(pickupPoints.id, members.pickupPointId)).where(where).orderBy(desc(payments.paidAt)).limit(pageSize).offset(offset);
    return { items, total: total.count, page, pageSize };
  }
  throw new ApiError('Unknown resource.', 404);
}

export async function localReport(pointId: string, from: string, to: string): Promise<Report> {
  if (!validDateRange(from, to)) throw new ApiError('Choose a valid date range of at most 366 days.');
  const point = pointId ? (await db.select().from(pickupPoints).where(eq(pickupPoints.id, uuid(pointId))))[0] : null;
  if (pointId && !point) throw new ApiError('Pickup point not found.');
  const result = await db.execute(sql`select m.qr_number, m.full_name, m.phone, coalesce(p.n,0)::int as payment_count, coalesce(p.total,0)::float as total from members m left join (select member_id, count(*) n, sum(amount) total from payments where paid_at >= ${startOf(from)} and paid_at < ${endOf(to)} group by member_id) p on p.member_id=m.id where ${point ? sql`m.pickup_point_id=${point.id}` : sql`true`} order by m.qr_number`);
  const rows = result.rows as unknown as ReportRow[];
  return { point, from, to, rows, grandTotal: rows.reduce((n, r) => n + Number(r.total), 0), paymentCount: rows.reduce((n, r) => n + Number(r.payment_count), 0) };
}

export function apiShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(apiShape);
  if (value && typeof value === 'object' && !(value instanceof Date)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), apiShape(item)]));
  return value;
}

export async function localMutation(action: string, body: Record<string, unknown>) {
  const values = (body.values || {}) as Record<string, unknown>;
  if (action === 'create-point' || action === 'update-point') {
    const data = validatePoint(values, action === 'update-point');
    if (action === 'create-point') return (await db.insert(pickupPoints).values(data).returning())[0];
    return (await db.update(pickupPoints).set({ name: data.name, isActive: data.is_active }).where(eq(pickupPoints.id, uuid(body.id))).returning())[0];
  }
  if (action === 'create-member' || action === 'update-member') {
    const input = validateMember(values);
    const data = { pickupPointId: input.pickup_point_id, fullName: input.full_name, qrNumber: input.qr_number, phone: input.phone, isActive: input.is_active };
    const [point] = await db.select().from(pickupPoints).where(eq(pickupPoints.id, data.pickupPointId));
    if (!point?.isActive) throw new ApiError('Choose an active pickup point.');
    if (action === 'create-member') return (await db.insert(members).values(data).returning())[0];
    return (await db.update(members).set(data).where(eq(members.id, uuid(body.id))).returning())[0];
  }
  if (action === 'import-members') {
    const input = body.rows as ImportRow[];
    if (!Array.isArray(input) || !input.length || input.length > 5000) throw new ApiError('Import between 1 and 5,000 members at a time.');
    const points = (await db.select().from(pickupPoints)).map(p => ({ id: p.id, code: p.code, is_active: p.isActive }));
    const existingRows = await db.select({ pickup_point_id: members.pickupPointId, qr_number: members.qrNumber }).from(members);
    const existing = new Set(existingRows.map(m => `${m.pickup_point_id}:${m.qr_number}`));
    const records = input.map((row, i) => { const result = validateImport(row, points, existing); if (result.errors.length || !result.member) throw new ApiError(`Row ${i + 2}: ${result.errors.join('; ')}`); const m = result.member; return { pickupPointId: m.pickup_point_id, fullName: m.full_name, qrNumber: m.qr_number, phone: m.phone, isActive: true }; });
    await db.transaction(async tx => { for (let i = 0; i < records.length; i += 500) await tx.insert(members).values(records.slice(i, i + 500)); });
    return { imported: records.length };
  }
  if (action === 'assign-payment') {
    const memberId = uuid(body.memberId);
    const [member] = await db.select({ id: members.id }).from(members).innerJoin(pickupPoints, eq(pickupPoints.id, members.pickupPointId)).where(and(eq(members.id, memberId), eq(members.isActive, true), eq(pickupPoints.isActive, true)));
    if (!member) throw new ApiError('Choose an active member at an active pickup point.');
    const [payment] = await db.update(payments).set({ memberId, status: 'matched' }).where(and(eq(payments.id, uuid(body.paymentId)), eq(payments.status, 'unmatched'))).returning();
    if (!payment) throw new ApiError('This payment has already been assigned or no longer exists.', 409);
    return payment;
  }
  throw new ApiError('Unknown action.', 404);
}

const caseSelection = {
  id: welfareCases.id,
  member_id: welfareCases.memberId,
  case_type: welfareCases.caseType,
  status: welfareCases.status,
  description: welfareCases.description,
  opened_at: welfareCases.openedAt,
  closed_at: welfareCases.closedAt,
  created_at: welfareCases.createdAt,
  member_name: members.fullName,
  member_phone: members.phone,
  member_qr: members.qrNumber,
  pickup_name: pickupPoints.name,
  pickup_code: pickupPoints.code,
};

export async function localListCases(filters: Filters) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 10));
  const offset = (page - 1) * pageSize;
  const conditions: SQL[] = [];
  if (filters.status && filters.status !== 'all') {
    if (!['open', 'closed'].includes(filters.status)) throw new ApiError('Invalid case status.');
    conditions.push(eq(welfareCases.status, filters.status as 'open' | 'closed'));
  }
  const where = and(...conditions);
  const [total] = await db.select({ count: count() }).from(welfareCases).where(where);
  const items = await db
    .select(caseSelection)
    .from(welfareCases)
    .innerJoin(members, eq(members.id, welfareCases.memberId))
    .innerJoin(pickupPoints, eq(pickupPoints.id, members.pickupPointId))
    .where(where)
    .orderBy(desc(welfareCases.openedAt))
    .limit(pageSize)
    .offset(offset);
  return { items, total: total.count, page, pageSize };
}

export async function localGetActiveCase() {
  const rows = await db
    .select(caseSelection)
    .from(welfareCases)
    .innerJoin(members, eq(members.id, welfareCases.memberId))
    .innerJoin(pickupPoints, eq(pickupPoints.id, members.pickupPointId))
    .where(eq(welfareCases.status, 'open'))
    .orderBy(desc(welfareCases.openedAt))
    .limit(1);
  return rows[0] || null;
}

export async function localOpenCase(body: Record<string, unknown>) {
  const memberId = uuid(body.memberId);
  const caseTypeVal = body.caseType as string;
  if (!['hospital', 'death'].includes(caseTypeVal)) throw new ApiError('Case type must be hospital or death.');
  const description = body.description ? String(body.description).trim().slice(0, 500) : null;
  // Enforce one open case at a time
  const [existing] = await db.select({ id: welfareCases.id }).from(welfareCases).where(eq(welfareCases.status, 'open')).limit(1);
  if (existing) throw new ApiError('There is already an open welfare case. Close it before opening a new one.');
  const [member] = await db.select({ id: members.id, fullName: members.fullName }).from(members).where(eq(members.id, memberId));
  if (!member) throw new ApiError('Member not found.');
  const [newCase] = await db.insert(welfareCases).values({ memberId, caseType: caseTypeVal as 'hospital' | 'death', status: 'open', description }).returning();
  return newCase;
}

export async function localCloseCase(body: Record<string, unknown>) {
  const id = uuid(body.id);
  const [updated] = await db
    .update(welfareCases)
    .set({ status: 'closed', closedAt: new Date() })
    .where(and(eq(welfareCases.id, id), eq(welfareCases.status, 'open')))
    .returning();
  if (!updated) throw new ApiError('Case not found or already closed.', 409);
  return updated;
}
