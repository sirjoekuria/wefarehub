import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/db';
import { pickupPoints, members, payments } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { isDemoMode } from '@/lib/demo-mode';
import { normalizePhone, parseReference, normalizeReference } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface RawPaymentInput {
  transaction_id?: string;
  receipt?: string;
  trans_id?: string;
  receipt_number?: string;
  mpesa_receipt?: string;
  amount?: number | string;
  trans_amount?: number | string;
  account_reference?: string;
  bill_ref?: string;
  bill_ref_number?: string;
  reference?: string;
  ref?: string;
  pickup_code?: string;
  pickup_point_code?: string;
  pickup?: string;
  qr_number?: string | number;
  qr?: string | number;
  member_qr?: string | number;
  phone?: string | number;
  payer_phone?: string | number;
  msisdn?: string | number;
  paid_at?: string;
  timestamp?: string | number;
  trans_time?: string;
  date?: string;
}

interface ProcessedResult {
  transaction_id: string;
  status: 'matched' | 'unmatched';
  member_id: string | null;
  member_name?: string | null;
  pickup_code: string | null;
  qr_number: string | null;
  amount: number;
  already_existed?: boolean;
}

function verifyAuth(req: NextRequest): boolean {
  const secret = process.env.ROCPAY_WEBHOOK_SECRET;
  // If no secret configured in environment, allow in local/demo environment
  if (!secret) return true;

  const headerSecret =
    req.headers.get('x-rocpay-secret') ||
    req.headers.get('x-api-key') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  return headerSecret === secret;
}

function parsePaidAtDate(val?: string | number): Date {
  if (!val) return new Date();
  if (typeof val === 'number') return new Date(val);

  // If format is Safaricom TransTime YYYYMMDDHHmmss (14 digits)
  if (/^\d{14}$/.test(val)) {
    const y = parseInt(val.slice(0, 4), 10);
    const m = parseInt(val.slice(4, 6), 10) - 1;
    const d = parseInt(val.slice(6, 8), 10);
    const h = parseInt(val.slice(8, 10), 10);
    const min = parseInt(val.slice(10, 12), 10);
    const s = parseInt(val.slice(12, 14), 10);
    // Nairobi is UTC+3
    const utcMs = Date.UTC(y, m, d, h, min, s) - 3 * 3600000;
    return new Date(utcMs);
  }

  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'Rocpay Offline Central Webhook',
    timestamp: new Date().toISOString(),
    documentation: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rocpay-secret': 'REQUIRED (if ROCPAY_WEBHOOK_SECRET is set in .env)',
      },
      supported_formats: [
        'Single transaction object',
        'Batch array: [ { ... }, { ... } ]',
        'Batch object: { batch: [ ... ] }',
      ],
      sample_payload: {
        transaction_id: 'ROC-20261101-001',
        amount: 200,
        account_reference: 'KM001#001',
        phone: '254712345678',
        paid_at: new Date().toISOString(),
      },
    },
  });
}

export async function POST(req: NextRequest) {
  // 1. Verify Authentication
  if (!verifyAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing Rocpay secret.' },
      { status: 401 }
    );
  }

  // 2. Parse Payload
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  // Normalize single object or array
  let items: RawPaymentInput[] = [];
  if (Array.isArray(body)) {
    items = body;
  } else if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj.batch)) items = obj.batch as RawPaymentInput[];
    else if (Array.isArray(obj.payments)) items = obj.payments as RawPaymentInput[];
    else if (Array.isArray(obj.transactions)) items = obj.transactions as RawPaymentInput[];
    else items = [obj as RawPaymentInput];
  }

  if (!items.length) {
    return NextResponse.json({ error: 'No transaction data provided in payload.' }, { status: 400 });
  }

  const results: ProcessedResult[] = [];
  const errors: Array<{ transaction_id?: string; error: string }> = [];

  const useSupabase =
    !isDemoMode() &&
    Boolean(
      (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

  const supabaseClient = useSupabase
    ? createClient(
        (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )
    : null;

  for (const item of items) {
    const transactionId = (
      item.transaction_id ||
      item.receipt ||
      item.trans_id ||
      item.receipt_number ||
      item.mpesa_receipt ||
      ''
    ).trim();

    if (!transactionId) {
      errors.push({ error: 'Missing transaction_id or receipt identifier.' });
      continue;
    }

    const rawAmount = item.amount ?? item.trans_amount;
    const amountNum = Number(rawAmount);
    if (!rawAmount || isNaN(amountNum) || amountNum <= 0) {
      errors.push({ transaction_id: transactionId, error: 'Invalid or non-positive amount.' });
      continue;
    }

    // Determine pickup code and QR number
    const refRaw = (
      item.account_reference ||
      item.bill_ref ||
      item.bill_ref_number ||
      item.reference ||
      item.ref ||
      ''
    ).trim();

    let pickupCode: string | null = null;
    let qrNumber: string | null = null;

    if (refRaw) {
      const parsedRef = parseReference(refRaw);
      if (parsedRef) {
        pickupCode = parsedRef.code;
        qrNumber = parsedRef.qr;
      }
    }

    if (!pickupCode && (item.pickup_code || item.pickup_point_code || item.pickup)) {
      pickupCode = String(item.pickup_code || item.pickup_point_code || item.pickup).trim().toUpperCase();
    }

    if (!qrNumber && (item.qr_number || item.qr || item.member_qr)) {
      qrNumber = String(item.qr_number || item.qr || item.member_qr).trim();
    }

    // Payer phone
    const rawPhone = String(item.phone || item.payer_phone || item.msisdn || '');
    const normalizedPhone = normalizePhone(rawPhone) || rawPhone.replace(/\D/g, '') || '254000000000';

    const paidAtDate = parsePaidAtDate(item.paid_at || item.timestamp || item.trans_time || item.date);
    const billRefFormatted = refRaw || (pickupCode && qrNumber ? `${pickupCode}#${qrNumber}` : 'ROCPAY_OFFLINE');

    try {
      let matchedMemberId: string | null = null;
      let memberName: string | null = null;

      // --- 3. Member Lookup ---
      if (useSupabase && supabaseClient) {
        if (pickupCode && qrNumber) {
          const { data: member } = await supabaseClient
            .from('members')
            .select('id, full_name, phone, pickup_points!inner(code, is_active)')
            .eq('qr_number', qrNumber)
            .eq('is_active', true)
            .eq('pickup_points.code', pickupCode)
            .eq('pickup_points.is_active', true)
            .maybeSingle();

          if (member) {
            matchedMemberId = member.id;
            memberName = member.full_name;
          }
        }

        // Secondary fallback: Lookup by normalized phone if not matched by QR
        if (!matchedMemberId && normalizedPhone && normalizedPhone !== '254000000000') {
          const { data: memberByPhone } = await supabaseClient
            .from('members')
            .select('id, full_name, qr_number, pickup_points!inner(code, is_active)')
            .eq('phone', normalizedPhone)
            .eq('is_active', true)
            .eq('pickup_points.is_active', true)
            .maybeSingle();

          if (memberByPhone) {
            matchedMemberId = memberByPhone.id;
            memberName = memberByPhone.full_name;
            if (!pickupCode && memberByPhone.pickup_points) {
              const pp = memberByPhone.pickup_points as unknown as { code: string };
              pickupCode = pp.code;
            }
            if (!qrNumber) {
              qrNumber = memberByPhone.qr_number;
            }
          }
        }

        const status = matchedMemberId ? 'matched' : 'unmatched';

        // Check if transaction already exists (for idempotent report)
        const { data: existing } = await supabaseClient
          .from('payments')
          .select('id, status, member_id')
          .eq('mpesa_receipt', transactionId)
          .maybeSingle();

        if (existing) {
          results.push({
            transaction_id: transactionId,
            status: existing.status as 'matched' | 'unmatched',
            member_id: existing.member_id,
            pickup_code: pickupCode,
            qr_number: qrNumber,
            amount: amountNum,
            already_existed: true,
          });
          continue;
        }

        const { error: insertError } = await supabaseClient.from('payments').insert({
          mpesa_receipt: transactionId,
          amount: amountNum.toFixed(2),
          payer_phone: normalizedPhone,
          bill_ref_raw: billRefFormatted,
          pickup_code_parsed: pickupCode,
          qr_parsed: qrNumber,
          member_id: matchedMemberId,
          status,
          paid_at: paidAtDate.toISOString(),
        });

        if (insertError) throw insertError;

        results.push({
          transaction_id: transactionId,
          status,
          member_id: matchedMemberId,
          member_name: memberName,
          pickup_code: pickupCode,
          qr_number: qrNumber,
          amount: amountNum,
          already_existed: false,
        });
      } else {
        // Local Drizzle DB mode
        let matchedMemberIdLocal: string | null = null;
        let memberNameLocal: string | null = null;

        if (pickupCode && qrNumber) {
          const [match] = await db
            .select({
              id: members.id,
              fullName: members.fullName,
              pickupCode: pickupPoints.code,
            })
            .from(members)
            .innerJoin(pickupPoints, eq(pickupPoints.id, members.pickupPointId))
            .where(
              and(
                eq(pickupPoints.code, pickupCode),
                eq(members.qrNumber, qrNumber),
                eq(members.isActive, true),
                eq(pickupPoints.isActive, true)
              )
            )
            .limit(1);

          if (match) {
            matchedMemberIdLocal = match.id;
            memberNameLocal = match.fullName;
          }
        }

        // Secondary fallback by phone
        if (!matchedMemberIdLocal && normalizedPhone && normalizedPhone !== '254000000000') {
          const [phoneMatch] = await db
            .select({
              id: members.id,
              fullName: members.fullName,
              qrNumber: members.qrNumber,
              pickupCode: pickupPoints.code,
            })
            .from(members)
            .innerJoin(pickupPoints, eq(pickupPoints.id, members.pickupPointId))
            .where(
              and(
                eq(members.phone, normalizedPhone),
                eq(members.isActive, true),
                eq(pickupPoints.isActive, true)
              )
            )
            .limit(1);

          if (phoneMatch) {
            matchedMemberIdLocal = phoneMatch.id;
            memberNameLocal = phoneMatch.fullName;
            pickupCode = pickupCode || phoneMatch.pickupCode;
            qrNumber = qrNumber || phoneMatch.qrNumber;
          }
        }

        const status = matchedMemberIdLocal ? 'matched' : 'unmatched';

        const [existing] = await db
          .select({ id: payments.id, status: payments.status, memberId: payments.memberId })
          .from(payments)
          .where(eq(payments.mpesaReceipt, transactionId))
          .limit(1);

        if (existing) {
          results.push({
            transaction_id: transactionId,
            status: existing.status,
            member_id: existing.memberId,
            pickup_code: pickupCode,
            qr_number: qrNumber,
            amount: amountNum,
            already_existed: true,
          });
          continue;
        }

        await db
          .insert(payments)
          .values({
            mpesaReceipt: transactionId,
            amount: amountNum.toFixed(2),
            payerPhone: normalizedPhone,
            billRefRaw: billRefFormatted,
            pickupCodeParsed: pickupCode,
            qrParsed: qrNumber,
            memberId: matchedMemberIdLocal,
            status,
            paidAt: paidAtDate,
          })
          .onConflictDoNothing({ target: payments.mpesaReceipt });

        results.push({
          transaction_id: transactionId,
          status,
          member_id: matchedMemberIdLocal,
          member_name: memberNameLocal,
          pickup_code: pickupCode,
          qr_number: qrNumber,
          amount: amountNum,
          already_existed: false,
        });
      }
    } catch (err) {
      console.error(`Failed to process transaction ${transactionId}:`, err);
      errors.push({
        transaction_id: transactionId,
        error: err instanceof Error ? err.message : 'Database insertion error',
      });
    }
  }

  const matchedCount = results.filter((r) => r.status === 'matched').length;
  const unmatchedCount = results.filter((r) => r.status === 'unmatched').length;

  return NextResponse.json(
    {
      success: errors.length === 0,
      processed: results.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      errors: errors.length ? errors : undefined,
      results,
    },
    { status: errors.length && !results.length ? 400 : 200 }
  );
}
