import { normalizePhone } from './utils';
import type { ImportRow } from './types';

export function validatePoint(input: Record<string, unknown>, editing = false) {
  const code = String(input.code || '').trim().toUpperCase();
  const name = String(input.name || '').trim();
  if (!editing && !/^[A-Z][A-Z0-9]{1,15}$/.test(code)) throw new Error('Use a 2–16 character pickup code, such as KM001.');
  if (code.includes('#')) throw new Error('Pickup codes cannot contain #.');
  if (name.length < 2 || name.length > 120) throw new Error('Enter a display name between 2 and 120 characters.');
  return { code, name, is_active: input.is_active !== false };
}
export function validateMember(input: Record<string, unknown>) {
  const full_name = String(input.full_name || '').trim();
  const qr_number = String(input.qr_number || '').trim();
  const pickup_point_id = String(input.pickup_point_id || '');
  const phone = normalizePhone(String(input.phone || ''));
  const rawId = input.id_number !== undefined && input.id_number !== null ? String(input.id_number).trim() : '';
  const id_number = rawId.length > 0 ? rawId : null;

  if (full_name.length < 2 || full_name.length > 120) throw new Error('Enter a full name between 2 and 120 characters.');
  if (!phone) throw new Error('Enter a valid Kenyan phone: 07xx, 01xx, or +254 followed by 9 digits.');
  if (!/^\d{1,12}$/.test(qr_number)) throw new Error('QR number must contain 1–12 digits. Leading zeros are preserved.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pickup_point_id)) throw new Error('Select a pickup point.');
  if (id_number && !/^\d{6,10}$/.test(id_number)) throw new Error('Kenyan National ID number must contain 6 to 10 digits.');

  return { full_name, phone, qr_number, pickup_point_id, id_number, is_active: input.is_active !== false };
}
export function validateImport(row: ImportRow, points: { id: string; code: string; is_active: boolean }[], existing: Set<string>) {
  const errors: string[] = [];
  const point = points.find(p => p.code === String(row.pickup_code || '').trim().toUpperCase());
  const phone = normalizePhone(String(row.phone || ''));
  const full_name = String(row.full_name || '').trim();
  const qr_number = String(row.qr_number || '').trim();
  if (full_name.length < 2 || full_name.length > 120) errors.push('Name must be 2–120 characters');
  if (!phone) errors.push('Invalid Kenyan phone');
  if (!/^\d{1,12}$/.test(qr_number)) errors.push('QR must be 1–12 digits');
  if (!point) errors.push('Unknown pickup code');
  else if (!point.is_active) errors.push('Pickup point is inactive');
  const key = `${point?.id}:${qr_number}`;
  if (point && existing.has(key)) errors.push('QR already exists at this pickup point');
  if (point) existing.add(key);
  return { errors, member: point && phone ? { full_name, phone, qr_number, pickup_point_id: point.id, is_active: true } : null };
}
