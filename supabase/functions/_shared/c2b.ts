import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizeReference, parseReference } from '../../../src/lib/utils.ts';

export function database() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase server configuration is missing.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export const accepted = () => Response.json({ ResultCode: 0, ResultDesc: 'Accepted' });
export const rejected = (description: string) => Response.json({ ResultCode: 'C2B00012', ResultDesc: description });
export type C2BPayload = { TransID?: string; TransAmount?: string | number; TransTime?: string; BillRefNumber?: string; MSISDN?: string | number; BusinessShortCode?: string | number };
export function parsePaidAt(value?: string) {
  if (!value || !/^\d{14}$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = [value.slice(0,4), value.slice(4,6), value.slice(6,8), value.slice(8,10), value.slice(10,12), value.slice(12,14)].map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(localAsUtc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || check.getUTCHours() !== hour || check.getUTCMinutes() !== minute || check.getUTCSeconds() !== second) return null;
  return new Date(localAsUtc - 3 * 3600000).toISOString();
}
export async function findMember(raw: string) {
  const parsed = parseReference(raw);
  if (!parsed) return { member: null, parsed: null };
  const { data, error } = await database().from('members').select('id, pickup_points!inner(code)').eq('qr_number', parsed.qr).eq('is_active', true).eq('pickup_points.code', parsed.code).eq('pickup_points.is_active', true).maybeSingle();
  if (error) throw error;
  return { member: data, parsed };
}
export function validPayload(body: C2BPayload) {
  const amount = Number(body.TransAmount);
  return typeof body.TransID === 'string' && /^[A-Z0-9]{6,32}$/.test(body.TransID) && Number.isFinite(amount) && amount > 0 && /^\d+(\.\d{1,2})?$/.test(String(body.TransAmount)) && String(body.BusinessShortCode) === Deno.env.get('MPESA_SHORTCODE') && String(body.BillRefNumber ?? '').length <= 128 && !!parsePaidAt(body.TransTime);
}
export async function accessToken() {
  const key = Deno.env.get('MPESA_CONSUMER_KEY');
  const secret = Deno.env.get('MPESA_CONSUMER_SECRET');
  if (!key || !secret) throw new Error('Daraja consumer credentials are not configured.');
  const base = Deno.env.get('MPESA_ENVIRONMENT') === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const response = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${btoa(`${key}:${secret}`)}` }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Daraja OAuth failed (${response.status}).`);
  const data = await response.json();
  if (!data.access_token) throw new Error('Daraja did not return an access token.');
  return { token: data.access_token as string, base };
}
export { normalizeReference, parseReference };
