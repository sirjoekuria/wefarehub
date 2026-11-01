import { database, accepted, findMember, validPayload, parsePaidAt, normalizeReference, type C2BPayload } from '../_shared/c2b.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return accepted();
  try {
    const body: C2BPayload = await req.json();
    if (!validPayload(body)) {
      console.error('Invalid C2B confirmation payload', { receipt: body.TransID });
      return accepted();
    }
    const raw = String(body.BillRefNumber ?? '');
    const { member, parsed } = await findMember(raw);
    const { error } = await database().from('payments').upsert({
      mpesa_receipt: body.TransID,
      amount: Number(body.TransAmount).toFixed(2),
      payer_phone: String(body.MSISDN ?? ''),
      bill_ref_raw: raw,
      pickup_code_parsed: parsed?.code ?? normalizeReference(raw).split('#')[0] ?? null,
      qr_parsed: parsed?.qr ?? normalizeReference(raw).split('#')[1] ?? null,
      member_id: member?.id ?? null,
      status: member ? 'matched' : 'unmatched',
      paid_at: parsePaidAt(body.TransTime),
    }, { onConflict: 'mpesa_receipt', ignoreDuplicates: true });
    if (error) throw error;
  } catch (error) {
    // Acknowledgement is required by the integration contract, including failures.
    // Log for operational monitoring; never silently convert a failed insert to matched.
    console.error('C2B confirmation persistence failed; reconcile provider logs', error);
  }
  return accepted();
});
