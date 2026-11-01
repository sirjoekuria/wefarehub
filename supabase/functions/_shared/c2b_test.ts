import { assertEquals } from 'jsr:@std/assert';
import { parsePaidAt, validPayload, normalizeReference, parseReference } from './c2b.ts';
import { normalizePhone } from '../../../src/lib/utils.ts';

Deno.env.set('MPESA_SHORTCODE', '234567');
const payload = { TransID: 'ABC123XYZ9', TransAmount: '250.25', TransTime: '20260601123045', BusinessShortCode: '234567', BillRefNumber: 'KM001#001', MSISDN: '254712345678' };
Deno.test('normalizes account references without losing leading zeros', () => {
  assertEquals(normalizeReference('  km001 # 001  '), 'KM001#001');
  assertEquals(parseReference(' km001 # 001 '), { code: 'KM001', qr: '001' });
});
Deno.test('rejects malformed account references', () => {
  for (const ref of ['', 'KM001001', 'KM001#', '#001', 'KM001#ABC', 'KM001#001#002', 'KM-001#001']) assertEquals(parseReference(ref), null);
});
Deno.test('validates and normalizes Kenyan phone formats', () => {
  for (const phone of ['0712345678', '+254712345678', '254712345678', '0712 345 678']) assertEquals(normalizePhone(phone), '254712345678');
  assertEquals(normalizePhone('0112345678'), '254112345678');
  for (const phone of ['123', '0812345678', '+2547123456789', '25471234567']) assertEquals(normalizePhone(phone), null);
});
Deno.test('interprets M-Pesa time in Nairobi, not UTC', () => {
  assertEquals(parsePaidAt('20260601123045'), '2026-06-01T09:30:45.000Z');
  assertEquals(parsePaidAt('20260601000000'), '2026-05-31T21:00:00.000Z');
  assertEquals(parsePaidAt('20260230123045'), null);
  assertEquals(parsePaidAt('20260601253045'), null);
});
Deno.test('accepts variable positive amounts with up to two decimal places', () => {
  assertEquals(validPayload(payload), true);
  assertEquals(validPayload({ ...payload, TransAmount: 100 }), true);
  assertEquals(validPayload({ ...payload, TransAmount: '10.10' }), true);
  for (const amount of ['0', '-1', '1.001', 'NaN', 'Infinity']) assertEquals(validPayload({ ...payload, TransAmount: amount }), false);
});
Deno.test('rejects wrong shortcode, malformed receipt and invalid timestamp', () => {
  assertEquals(validPayload({ ...payload, BusinessShortCode: '999999' }), false);
  assertEquals(validPayload({ ...payload, TransID: 'bad receipt' }), false);
  assertEquals(validPayload({ ...payload, TransTime: 'invalid' }), false);
});
