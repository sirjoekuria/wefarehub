import { accepted, rejected, findMember, validPayload, type C2BPayload } from '../_shared/c2b.ts';

// Safaricom must reach this endpoint without a Supabase JWT.
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return rejected('Use POST for M-Pesa validation.');
  try {
    const body: C2BPayload = await req.json();
    if (!validPayload(body)) return rejected('Invalid payment details. Check the amount, receipt and Paybill.');
    const { member, parsed } = await findMember(String(body.BillRefNumber ?? ''));
    if (!parsed) return rejected('Invalid account format. Use PICKUPCODE#QRNUMBER, for example KM001#001.');
    if (!member) return rejected('Member not found or inactive. Check the pickup code and QR number with your administrator.');
    return accepted();
  } catch (error) {
    console.error('C2B validation error', error);
    return rejected('Unable to verify this account. Please try again shortly.');
  }
});
