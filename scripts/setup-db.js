const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');
const { scryptSync, randomBytes } = require('crypto');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `s2:${salt}:${hash}`;
}

async function setup() {
  const dataDir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  console.log('1. Initializing in-memory PGlite engine...');
  const pglite = new PGlite();
  await pglite.waitReady;

  const migrationSql = fs.readFileSync(path.join(process.cwd(), 'drizzle', '0000_dusty_moondragon.sql'), 'utf8');
  const statements = migrationSql.split('--> statement-breakpoint');

  console.log(`2. Executing ${statements.length} migration statements...`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;
    try {
      await pglite.query(stmt);
    } catch (e) {
      if (!e.message.includes('already exists') && !e.message.includes('duplicate key')) {
        console.warn(`Statement ${i} note: ${e.message}`);
      }
    }
  }
  console.log('Schema migration complete!');

  // Real password hashes
  const adminPassHash = hashPassword('December25J#');

  console.log('3. Seeding real super admin (kuriajoe85@gmail.com)...');
  await pglite.query(`
    INSERT INTO users (id, email, password_hash, full_name, phone, platform_role)
    VALUES 
      (1, 'kuriajoe85@gmail.com', $1, 'Joseph Kuria', '254700898950', 'super_admin')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, platform_role = 'super_admin', full_name = 'Joseph Kuria';
  `, [adminPassHash]);

  // Subscription Plans
  console.log('4. Seeding subscription plans...');
  await pglite.query(`
    INSERT INTO subscription_plans (id, code, name, description, monthly_price_kes, annual_price_kes, max_stations, max_members, max_admins, storage_mb, is_active, sort_order)
    VALUES
      (1, 'starter', 'Starter', 'Small associations getting started (up to 3 stations, 100 members)', 1500, 15000, 3, 100, 2, 100, true, 1),
      (2, 'growth', 'Growth', 'Growing associations with multiple stations (up to 10 stations, 500 members)', 3500, 35000, 10, 500, 5, 500, true, 2),
      (3, 'professional', 'Professional', 'Large associations with full reporting (up to 25 stations, 2,000 members)', 7500, 75000, 25, 2000, 10, 2048, true, 3),
      (4, 'enterprise', 'Enterprise', 'Multi-constituency federations & county unions', 15000, 150000, 200, 20000, 50, 10240, true, 4)
    ON CONFLICT (code) DO UPDATE SET 
      name = EXCLUDED.name, 
      monthly_price_kes = EXCLUDED.monthly_price_kes,
      annual_price_kes = EXCLUDED.annual_price_kes,
      max_stations = EXCLUDED.max_stations,
      max_members = EXCLUDED.max_members;
  `);

  console.log('5. Synchronizing sequences to avoid duplicate primary key collisions...');
  const seqRes = await pglite.query(`
    SELECT
      s.relname AS sequence_name,
      t.relname AS table_name,
      a.attname AS column_name
    FROM pg_class s
    JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.deptype = 'a'
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    WHERE s.relkind = 'S';
  `);
  for (const row of seqRes.rows) {
    try {
      await pglite.query(`
        SELECT setval(
          '${row.sequence_name}',
          COALESCE((SELECT MAX("${row.column_name}") FROM "${row.table_name}"), 1),
          (SELECT MAX("${row.column_name}") IS NOT NULL FROM "${row.table_name}")
        );
      `);
    } catch {}
  }

  console.log('6. Clean state initialized: ready for new real association onboarding!');
  console.log('7. Dumping clean database snapshot to .data/pgdata.tar...');
  const tarBlob = await pglite.dumpDataDir();
  const tarBuf = Buffer.from(await tarBlob.arrayBuffer());
  fs.writeFileSync(path.join(dataDir, 'pgdata.tar'), tarBuf);
  await pglite.close();

  console.log(`✅ CLEAN DATABASE DUMP COMPLETE! Size: ${(tarBuf.length / (1024 * 1024)).toFixed(2)} MB`);
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
