import 'dotenv/config';
import { scryptSync, randomBytes } from 'node:crypto';
import { db, pool } from '../src/db';
import { pickupPoints, members, payments, demoAdmins } from '../src/db/schema';
import { count, sql } from 'drizzle-orm';
import { today } from '../src/lib/utils';
import { isDemoMode } from '../src/lib/demo-mode';

async function seed() {
  if (!isDemoMode()) throw new Error('Demo seed is disabled outside the demo workspace.');
  const email = process.env.DEMO_ADMIN_EMAIL || 'admin@stanriders.co.ke';
  const password = process.env.DEMO_ADMIN_PASSWORD || (process.env.E2B_SANDBOX === 'true' ? randomBytes(24).toString('hex') : undefined);
  if (!password || password.length < 12) throw new Error('Set a demo password of at least 12 characters.');
  const salt = randomBytes(16).toString('hex');
  await db.insert(demoAdmins).values({ email, passwordHash: `${salt}:${scryptSync(password, salt, 64).toString('hex')}` }).onConflictDoUpdate({ target: demoAdmins.email, set: { passwordHash: `${salt}:${scryptSync(password, salt, 64).toString('hex')}` } });
  const existing = await db.select({ count: count() }).from(pickupPoints);
  if (existing[0].count) { console.log('Demo data already exists; admin credentials ensured.'); return; }
  let seedValue = 42;
  const random = () => { seedValue = (seedValue * 1664525 + 1013904223) >>> 0; return seedValue / 4294967296; };
  
  const points = await db.insert(pickupPoints).values(Array.from({ length: 108 }, (_, i) => ({ code: `KM${String(i + 1).padStart(3, '0')}`, name: `STANRIDERS KM${String(i + 1).padStart(3, '0')}`, isActive: i < 104 }))).returning();
  // Readable point names supplement the unique display code.
  await db.execute(sql`select 1`);
  const firstNames = ['John', 'Peter', 'James', 'David', 'Joseph', 'Samuel', 'Daniel', 'Paul', 'Brian', 'Kevin', 'Dennis', 'Eric', 'George', 'Martin', 'Stephen', 'Francis', 'Michael', 'Patrick', 'Alex', 'Vincent', 'Grace', 'Mary', 'Faith', 'Ann', 'Jane', 'Lucy', 'Mercy', 'Esther'];
  const lastNames = ['Mwangi', 'Ochieng', 'Kamau', 'Otieno', 'Kiprop', 'Mutua', 'Njoroge', 'Kiptoo', 'Omondi', 'Wanjala', 'Kariuki', 'Maina', 'Kimani', 'Odhiambo', 'Kibet', 'Muthoni', 'Wambua', 'Ndungu', 'Cheruiyot', 'Wafula'];
  const allMembers: { pickupPointId: string; fullName: string; phone: string; qrNumber: string; isActive: boolean }[] = [];
  points.forEach((point, i) => {
    for (let j = 0; j < 18; j++) allMembers.push({ pickupPointId: point.id, fullName: `${firstNames[(i * 3 + j) % firstNames.length]} ${lastNames[(i + j * 3) % lastNames.length]}`, phone: `2547${String(10000000 + i * 100 + j)}`, qrNumber: String(j + 1).padStart(3, '0'), isActive: j < 17 });
  });
  const riderRows = await db.insert(members).values(allMembers).returning();
  const records: { mpesaReceipt: string; amount: string; payerPhone: string; billRefRaw: string; pickupCodeParsed: string | null; qrParsed: string | null; memberId: string | null; status: 'matched' | 'unmatched'; paidAt: Date }[] = [];
  const amounts = [100, 150, 200, 200, 250, 300, 300, 400, 500, 500, 600, 700, 800, 1000, 1500];
  const now = Date.now();
  for (let day = 29; day >= 0; day--) {
    const n = day === 0 ? 126 : 175 + Math.floor(random() * 65);
    for (let j = 0; j < n; j++) {
      const member = riderRows[Math.floor(random() * riderRows.length)];
      const point = points.find(p => p.id === member.pickupPointId)!;
      const unmatched = random() < 0.006;
      const ref = `${point.code}#${member.qrNumber}`;
      const date = day === 0 ? new Date(now - (j + 1) * 90000) : new Date(now - day * 86400000 - Math.floor(random() * 72000000));
      records.push({ mpesaReceipt: `T${String(day).padStart(2, '0')}${String(j).padStart(4, '0')}KMR`, amount: String(amounts[Math.floor(random() * amounts.length)]), payerPhone: member.phone, billRefRaw: unmatched ? (j % 2 ? `${point.code}${member.qrNumber}` : 'KM999#001') : ref, pickupCodeParsed: unmatched && j % 2 ? null : point.code, qrParsed: unmatched && j % 2 ? null : member.qrNumber, memberId: unmatched ? null : member.id, status: unmatched ? 'unmatched' : 'matched', paidAt: date });
    }
  }
  for (let i = 0; i < records.length; i += 500) await db.insert(payments).values(records.slice(i, i + 500));
  console.log(`Seeded ${points.length} pickup points, ${riderRows.length} members and ${records.length} sample payments for ${today()}.`);
}
seed().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
