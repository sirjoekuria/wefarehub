import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Dashboard, Filters, ImportRow, Page, Payment, SessionUser, WelfareCase } from './types';
import { normalizePhone, validDateRange, validFilterDates } from './utils';
import { validatePoint, validateMember, validateImport } from './validation';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabase = Boolean(url && key);
let client: SupabaseClient | null = null;
export function supabase() { if (!url || !key) throw new Error('Supabase is not configured.'); return client ||= createClient(url, key); }
async function local<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401) window.dispatchEvent(new Event('rw:unauthorized')); throw new Error(data.error || 'Unable to complete the request.'); }
  return data;
}
export async function getSession(): Promise<SessionUser | null> {
  if (isSupabase) { const { data, error } = await supabase().auth.getUser(); return error || !data.user ? null : { email: data.user.email || 'Administrator', name: 'Administrator', demo: false }; }
  const data = await local<{ user: SessionUser | null }>('/api/auth/session'); return data.user;
}
export async function signIn(email: string, password: string) {
  if (isSupabase) {
    const { data: authData, error } = await supabase().auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message?.toLowerCase().includes('email not confirmed') || (error as { code?: string }).code === 'email_not_confirmed') {
        throw new Error('Email not confirmed. Supabase has sent a confirmation link to ' + email + '. Please click the link in your inbox to activate your account, then sign in.');
      }
      throw new Error(error.message || 'Unable to sign in. Check your email and password.');
    }
    // Record audit event for successful login
    try {
      await supabase().from('audit_logs').insert({
        actor_id: authData?.user?.id || null,
        actor_email: email.trim(),
        action: 'auth.login',
        entity_type: 'auth',
        entity_name: 'Administrator sign in',
        details: { user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null },
      });
    } catch {}
    return;
  }
  await local('/api/auth/session', { method: 'POST', body: JSON.stringify({ email, password }) });
}
export async function resendConfirmationEmail(email: string) {
  if (isSupabase) {
    const { error } = await supabase().auth.resend({ type: 'signup', email });
    if (error) throw new Error(error.message);
  }
}
export async function resetPassword(email: string) {
  if (isSupabase) {
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/#reset` : undefined;
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl });
    if (error) throw new Error(error.message);
    try {
      await supabase().from('audit_logs').insert({
        actor_email: email.trim(),
        action: 'auth.password_reset_request',
        entity_type: 'auth',
        entity_name: 'Password reset requested',
        details: { email: email.trim() },
      });
    } catch {}
    return;
  }
  await local('/api/auth/reset', { method: 'POST', body: JSON.stringify({ email }) });
}
export async function updatePassword(newPassword: string) {
  if (isSupabase) {
    const { error } = await supabase().auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    try {
      await supabase().from('audit_logs').insert({
        actor_email: 'administrator',
        action: 'auth.password_reset_complete',
        entity_type: 'auth',
        entity_name: 'Password changed successfully',
        details: { success: true },
      });
    } catch {}
    return;
  }
  await local('/api/auth/reset', { method: 'PUT', body: JSON.stringify({ password: newPassword }) });
}
export async function signOut() { 
  if (isSupabase) { 
    try {
      const user = (await supabase().auth.getUser()).data?.user;
      await supabase().from('audit_logs').insert({
        actor_id: user?.id || null,
        actor_email: user?.email || 'administrator',
        action: 'auth.logout',
        entity_type: 'auth',
        entity_name: 'Administrator sign out',
        details: {},
      });
    } catch {}
    const { error } = await supabase().auth.signOut(); 
    if (error) throw error; 
  } else await local('/api/auth/session', { method: 'DELETE' }); 
}

function dateFilters<T extends { gte: (column: string, value: string) => T; lt: (column: string, value: string) => T }>(query: T, filters: Filters) {
  if (!validFilterDates(filters.from, filters.to)) throw new Error('Choose a valid date range.');
  if (filters.from) query = query.gte('paid_at', `${filters.from}T00:00:00+03:00`);
  if (filters.to) query = query.lt('paid_at', new Date(new Date(`${filters.to}T00:00:00+03:00`).getTime() + 86400000).toISOString());
  return query;
}
export async function list<T>(resource: string, filters: Filters = {}): Promise<Page<T>> {
  if (!isSupabase) return local(`/api/data?resource=${resource}&${new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`);
  const db = supabase();
  const page = Math.max(1, filters.page || 1), pageSize = resource === 'member-options' ? 40 : Math.min(100, filters.pageSize || 10);
  const from = (page - 1) * pageSize;
  const term = (filters.search || '').trim().replace(/[%_(),]/g, ' ');
  let query;
  if (resource === 'pickup-points') {
    query = db.from('pickup_points').select('*, members(count)', { count: 'exact' });
    if (term) query = query.or(`code.ilike.%${term}%,name.ilike.%${term}%`);
    if (filters.active === 'active') query = query.eq('is_active', true);
    if (filters.active === 'inactive') query = query.eq('is_active', false);
    query = query.order('code');
  } else if (resource === 'members' || resource === 'member-options') {
    query = db.from('members').select('*, pickup_points(code,name)', { count: 'exact' });
    if (filters.point) query = query.eq('pickup_point_id', filters.point);
    if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,qr_number.ilike.%${term}%`);
    if (resource === 'member-options') query = query.eq('is_active', true);
    else if (filters.active === 'active') query = query.eq('is_active', true);
    else if (filters.active === 'inactive') query = query.eq('is_active', false);
    query = query.order('full_name');
  } else if (resource === 'payments') {
    query = db.from('payments').select('*, members(full_name,pickup_points(code,name))', { count: 'exact' });
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.point) { const { data, error } = await db.from('pickup_points').select('code').eq('id', filters.point).single(); if (error) throw error; query = query.or(`member_id.in.(${(await db.from('members').select('id').eq('pickup_point_id', filters.point)).data?.map(m => `\"${m.id}\"`).join(',') || '00000000-0000-0000-0000-000000000000'}),and(status.eq.unmatched,pickup_code_parsed.eq.${data.code})`); }
    if (term) {
      const { data: riders, error: riderError } = await db.from('members').select('id').ilike('full_name', `%${term}%`).range(0, 9999);
      if (riderError) throw riderError;
      const ids = (riders || []).map(m => `"${m.id}"`).join(',') || '00000000-0000-0000-0000-000000000000';
      query = query.or(`mpesa_receipt.ilike.%${term}%,bill_ref_raw.ilike.%${term}%,payer_phone.ilike.%${term}%,member_id.in.(${ids})`);
    }
  } else if (resource === 'audit-logs') {
    query = db.from('audit_logs').select('*', { count: 'exact' });
    if (filters.action && filters.action !== 'all') query = query.eq('action', filters.action);
    if (filters.entityType && filters.entityType !== 'all') query = query.eq('entity_type', filters.entityType);
    if (term) query = query.or(`actor_email.ilike.%${term}%,action.ilike.%${term}%,entity_name.ilike.%${term}%,entity_type.ilike.%${term}%`);
    if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00+03:00`);
    if (filters.to) query = query.lt('created_at', new Date(new Date(`${filters.to}T00:00:00+03:00`).getTime() + 86400000).toISOString());
    query = query.order('created_at', { ascending: false });
  } else throw new Error('Unknown resource.');
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) {
    if (resource === 'audit-logs' && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      return { items: [] as T[], total: 0, page, pageSize };
    }
    throw new Error(error.message);
  }
  const items = (data || []).map((row: Record<string, unknown>) => {
    if (resource === 'pickup-points') return { ...row, member_count: (row.members as { count: number }[])?.[0]?.count || 0 };
    if (resource === 'payments') { const member = row.members as { full_name: string; pickup_points: { code: string; name: string } } | null; return { ...row, member_name: member?.full_name, pickup_name: member?.pickup_points?.name, pickup_code: member?.pickup_points?.code }; }
    return row;
  });
  return { items: items as T[], total: count || 0, page, pageSize };
}
export async function dashboard(days: number): Promise<Dashboard> { if (!isSupabase) return local(`/api/data?resource=dashboard&days=${days}`); const { data, error } = await supabase().rpc('admin_dashboard', { p_days: days }); if (error) throw error; return data; }
export async function report(point: string, from: string, to: string): Promise<import('./types').Report> { if (!isSupabase) return local(`/api/data?resource=report&point=${point}&from=${from}&to=${to}`); if (!validDateRange(from, to)) throw new Error('Choose a valid date range of at most 366 days.'); const { data, error } = await supabase().rpc('admin_report', { p_pickup_point_id: point || null, p_from: from, p_to: to }); if (error) throw error; return data; }

type MutationPayload = { id?: string; values?: Record<string, unknown>; rows?: ImportRow[]; paymentId?: string; memberId?: string };
export async function mutate(action: string, payload: MutationPayload) {
  if (!isSupabase) return local('/api/data', { method: 'POST', body: JSON.stringify({ action, ...payload }) });
  const db = supabase(); const values = payload.values || {};
  let result;
  if (action === 'create-point' || action === 'update-point') {
    const data = validatePoint(values, action === 'update-point');
    result = action === 'create-point' ? await db.from('pickup_points').insert(data).select().single() : await db.from('pickup_points').update({ name: data.name, is_active: data.is_active }).eq('id', payload.id!).select().single();
    if (!result.error) {
      try {
        await db.from('audit_logs').insert({
          action: action === 'create-point' ? 'pickup_point.create' : 'pickup_point.update',
          entity_type: 'pickup_point',
          entity_id: result.data.id,
          entity_name: data.name,
          details: { code: data.code, is_active: data.is_active },
        });
      } catch {}
    }
  } else if (action === 'create-member' || action === 'update-member') {
    const data = validateMember(values);
    const { data: point, error: pointError } = await db.from('pickup_points').select('id,name,code').eq('id', data.pickup_point_id).eq('is_active', true).maybeSingle();
    if (pointError) throw pointError; if (!point) throw new Error('Choose an active pickup point.');
    result = action === 'create-member' ? await db.from('members').insert(data).select().single() : await db.from('members').update(data).eq('id', payload.id!).select().single();
    if (!result.error) {
      try {
        await db.from('audit_logs').insert({
          action: action === 'create-member' ? 'member.create' : 'member.update',
          entity_type: 'member',
          entity_id: result.data.id,
          entity_name: data.full_name,
          details: { phone: data.phone, qr_number: data.qr_number, pickup_code: point.code, pickup_name: point.name },
        });
      } catch {}
    }
  } else if (action === 'import-members') {
    const rows = payload.rows || [];
    if (!rows.length || rows.length > 5000) throw new Error('Import between 1 and 5,000 members at a time.');
    const { data: points, error: pointError } = await db.from('pickup_points').select('id,code,is_active').range(0, 9999); if (pointError) throw pointError;
    const existingRows = await existingMembers();
    const existing = new Set(existingRows.map(m => `${m.pickup_point_id}:${m.qr_number}`));
    const records = rows.map((row, i) => { const checked = validateImport(row, points || [], existing); if (!checked.member || checked.errors.length) throw new Error(`Row ${i + 2}: ${checked.errors.join('; ')}`); return checked.member; });
    result = await db.from('members').insert(records).select();
    if (!result.error) {
      try {
        await db.from('audit_logs').insert({
          action: 'member.import',
          entity_type: 'member',
          entity_name: `Bulk import of ${records.length} members`,
          details: { count: records.length },
        });
      } catch {}
      return { imported: records.length };
    }
  } else if (action === 'assign-payment') {
    const { data: member, error: memberError } = await db.from('members').select('id,full_name,qr_number,pickup_points!inner(code,name,is_active)').eq('id', payload.memberId!).eq('is_active', true).eq('pickup_points.is_active', true).maybeSingle();
    if (memberError) throw memberError; if (!member) throw new Error('Choose an active member at an active pickup point.');
    result = await db.from('payments').update({ member_id: payload.memberId, status: 'matched' }).eq('id', payload.paymentId!).eq('status', 'unmatched').select().single();
    if (result.error) throw new Error('This payment could not be assigned. It may already be matched; refresh and try again.');
    try {
      await db.from('audit_logs').insert({
        action: 'payment.manual_match',
        entity_type: 'payment',
        entity_id: payload.paymentId,
        entity_name: result.data.mpesa_receipt,
        details: { member_id: payload.memberId, member_name: member.full_name, amount: result.data.amount },
      });
    } catch {}
  } else throw new Error('Unknown action.');
  if (result.error) { if (result.error.code === '23505') throw new Error('This code or QR number already exists at the selected pickup point.'); throw new Error(result.error.message); }
  return result.data;
}
export function displayPhone(phone: string) { const normalized = normalizePhone(phone); return normalized ? '0' + normalized.slice(3) : phone; }
export type { Payment };
export async function enterDemo() { if (isSupabase) throw new Error('Demo access is not available on this deployment.'); await local('/api/auth/session', { method: 'POST', body: JSON.stringify({ demo: true }) }); }
export async function existingMembers(): Promise<{ pickup_point_id: string; qr_number: string }[]> {
  if (!isSupabase) return local('/api/data?resource=member-keys');
  const records: { pickup_point_id: string; qr_number: string }[] = [];
  for (let page = 0; page < 100; page++) { const { data, error } = await supabase().from('members').select('pickup_point_id,qr_number').range(page * 1000, page * 1000 + 999); if (error) throw error; records.push(...(data || [])); if (!data || data.length < 1000) break; }
  return records;
}

// ── Welfare Cases ────────────────────────────────────────────────────────────
export async function listCases(filters: Filters = {}): Promise<Page<WelfareCase>> {
  if (!isSupabase) return local(`/api/data?resource=cases&${new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`);
  const db = supabase();
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(50, filters.pageSize || 10);
  const from = (page - 1) * pageSize;
  let query = db.from('welfare_cases').select('*, members(full_name, phone, qr_number, pickup_points(name, code))', { count: 'exact' });
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  query = query.order('opened_at', { ascending: false });
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  const items = (data || []).map((row: Record<string, unknown>) => {
    const m = row.members as { full_name: string; phone: string; qr_number: string; pickup_points: { name: string; code: string } } | null;
    return { ...row, member_name: m?.full_name, member_phone: m?.phone, member_qr: m?.qr_number, pickup_name: m?.pickup_points?.name, pickup_code: m?.pickup_points?.code };
  });
  return { items: items as WelfareCase[], total: count || 0, page, pageSize };
}
export async function getActiveCase(): Promise<WelfareCase | null> {
  if (!isSupabase) return local('/api/data?resource=active-case');
  const { data, error } = await supabase().from('welfare_cases').select('*, members(full_name, phone, qr_number, pickup_points(name, code))').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const m = (data as Record<string, unknown>).members as { full_name: string; phone: string; qr_number: string; pickup_points: { name: string; code: string } } | null;
  return { ...data as unknown as WelfareCase, member_name: m?.full_name, member_phone: m?.phone, member_qr: m?.qr_number, pickup_name: m?.pickup_points?.name, pickup_code: m?.pickup_points?.code };
}
export async function openCase(memberId: string, caseType: 'hospital' | 'death', description: string): Promise<WelfareCase> {
  if (!isSupabase) return local('/api/data', { method: 'POST', body: JSON.stringify({ action: 'open-case', memberId, caseType, description }) });
  const db = supabase();
  const { data: existing } = await db.from('welfare_cases').select('id').eq('status', 'open').limit(1).maybeSingle();
  if (existing) throw new Error('There is already an open welfare case. Close it before opening a new one.');
  const { data, error } = await db.from('welfare_cases').insert({ member_id: memberId, case_type: caseType, description: description || null, status: 'open' }).select().single();
  if (error) throw new Error(error.message);
  try {
    const { data: m } = await db.from('members').select('full_name').eq('id', memberId).maybeSingle();
    await db.from('audit_logs').insert({
      action: 'welfare_case.create',
      entity_type: 'welfare_case',
      entity_id: data.id,
      entity_name: m?.full_name ? `Case for ${m.full_name}` : 'Welfare Case',
      details: { member_id: memberId, case_type: caseType, description },
    });
  } catch {}
  return data as WelfareCase;
}
export async function closeCase(id: string): Promise<WelfareCase> {
  if (!isSupabase) return local('/api/data', { method: 'POST', body: JSON.stringify({ action: 'close-case', id }) });
  const { data, error } = await supabase().from('welfare_cases').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', id).eq('status', 'open').select().single();
  if (error || !data) throw new Error('Case not found or already closed.');
  try {
    await supabase().from('audit_logs').insert({
      action: 'welfare_case.close',
      entity_type: 'welfare_case',
      entity_id: id,
      entity_name: 'Welfare Case Closed',
      details: { closed_at: new Date().toISOString() },
    });
  } catch {}
  return data as WelfareCase;
}

