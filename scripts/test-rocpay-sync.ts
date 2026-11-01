import 'dotenv/config';

/**
 * Script to test syncing offline payments from Rocpay to Stanriders Welfare.
 * Run with: npx tsx scripts/test-rocpay-sync.ts [endpoint_url]
 *
 * Example:
 *   npx tsx scripts/test-rocpay-sync.ts http://localhost:3000/api/webhooks/rocpay
 */

const targetUrl = process.argv[2] || 'http://localhost:3000/api/webhooks/rocpay';
const secret = process.env.ROCPAY_WEBHOOK_SECRET || 'rocpay_secret_stanriders_2026';

async function testRocpaySync() {
  console.log(`\nTesting Rocpay Sync against: ${targetUrl}`);
  console.log(`Using Rocpay Secret: ${secret.slice(0, 4)}****\n`);

  // 1. GET endpoint health check
  try {
    const healthRes = await fetch(targetUrl);
    const healthData = await healthRes.json();
    console.log('✅ GET Health check response:', healthData.service || healthData);
  } catch (err) {
    console.warn('⚠️ GET check failed (make sure your server is running with `npm run dev`):', err instanceof Error ? err.message : err);
  }

  // 2. Test batch offline payment payload
  const uniqueSuffix = Date.now().toString().slice(-6);
  const sampleBatch = {
    batch: [
      {
        transaction_id: `ROCPAY-TEST-${uniqueSuffix}-01`,
        amount: 250.0,
        account_reference: 'KM001#001',
        phone: '0712345678',
        paid_at: new Date().toISOString(),
      },
      {
        transaction_id: `ROCPAY-TEST-${uniqueSuffix}-02`,
        amount: 150.0,
        pickup_code: 'KM001',
        qr_number: '002',
        payer_phone: '254799887766',
        paid_at: new Date().toISOString(),
      },
      {
        transaction_id: `ROCPAY-TEST-${uniqueSuffix}-03`,
        amount: 50.0,
        account_reference: 'UNKNOWN#9999', // Deliberate unmatched test
        phone: '0700000000',
        paid_at: new Date().toISOString(),
      },
    ],
  };

  console.log('\nSending test batch payload:');
  console.log(JSON.stringify(sampleBatch, null, 2));

  try {
    const postRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rocpay-secret': secret,
      },
      body: JSON.stringify(sampleBatch),
    });

    const postData = await postRes.json();
    console.log(`\nStatus: ${postRes.status} ${postRes.statusText}`);
    console.log('Response:');
    console.log(JSON.stringify(postData, null, 2));

    if (postRes.ok) {
      console.log('\n✅ Sync test completed successfully!');
    } else {
      console.error('\n❌ Sync test returned an error.');
    }
  } catch (err) {
    console.error('\n❌ Failed to send request to target URL:', err instanceof Error ? err.message : err);
    console.log('\n💡 Hint: Start the development server first with: npm run dev');
  }
}

testRocpaySync();
