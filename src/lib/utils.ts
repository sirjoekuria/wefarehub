export const ASSOCIATION = 'ROCS CREW WELFARE ASSOCIATION';
export const PAYBILL = process.env.NEXT_PUBLIC_MPESA_SHORTCODE || '1353096';
export const NAIROBI = 'Africa/Nairobi';
export const money = (value: number | string, decimals = false) => 'KES ' + Number(value).toLocaleString('en-KE', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: 2 });
export const number = (value: number | string) => Number(value).toLocaleString('en-KE');
export const dateLabel = (value: string, options?: Intl.DateTimeFormatOptions) => new Date(value).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: NAIROBI, ...options });
export const timeLabel = (value: string) => new Date(value).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', timeZone: NAIROBI });
export const nairobiDate = (value: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: NAIROBI, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export const today = () => nairobiDate(new Date());
export function validFilterDates(from = '', to = '') {
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  return (!from || valid(from)) && (!to || valid(to)) && (!from || !to || from <= to);
}
export function monthStart() { const t = today(); return t.slice(0, 8) + '01'; }
export function normalizePhone(value: string) {
  const phone = value.replace(/[\s()-]/g, '');
  if (/^0(7|1)\d{8}$/.test(phone)) return '254' + phone.slice(1);
  if (/^\+254(7|1)\d{8}$/.test(phone)) return phone.slice(1);
  if (/^254(7|1)\d{8}$/.test(phone)) return phone;
  return null;
}
export function normalizeReference(value: string) { return value.trim().toUpperCase().replace(/\s/g, ''); }
export function parseReference(value: string) {
  const normalized = normalizeReference(value);
  const match = /^([A-Z][A-Z0-9]{1,15})#([0-9]{1,12})$/.exec(normalized);
  return match ? { code: match[1], qr: match[2] } : null;
}
export function validDateRange(from: string, to: string) {
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  return valid(from) && valid(to) && from <= to && (Date.parse(to) - Date.parse(from)) / 86400000 <= 366;
}
export function initials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase(); }
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
