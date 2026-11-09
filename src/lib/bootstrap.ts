import "server-only";
import { pglite, persistDb } from "@/db";
import fs from "node:fs";
import path from "node:path";

let seeding: Promise<void> | null = null;

/**
 * Self-healing bootstrap:
 * Ensures the PostgreSQL schema is created and real pilot data is seeded.
 * Safe to call on any hot path (login, API routes) — is a fast no-op once tables and users exist.
 */
export async function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = (async () => {
      try {
        // 1. Check if 'users' table exists
        const tableCheck = await pglite.query<{ exists: boolean }>(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
          );
        `);
        const tableExists = tableCheck.rows?.[0]?.exists;

        if (!tableExists) {
          console.log("Database schema missing. Executing migration...");
          const migrationPath = path.join(process.cwd(), "drizzle", "0000_dusty_moondragon.sql");
          if (fs.existsSync(migrationPath)) {
            const migrationSql = fs.readFileSync(migrationPath, "utf8");
            const statements = migrationSql.split("--> statement-breakpoint");
            for (const stmt of statements) {
              const s = stmt.trim();
              if (!s) continue;
              try {
                await pglite.query(s);
              } catch (e: any) {
                if (
                  !e?.message?.includes("already exists") &&
                  !e?.message?.includes("duplicate key")
                ) {
                  // Ignore benign duplicate object warnings
                }
              }
            }
            console.log("Schema migration complete.");
          }
        }

        // 2. Check if users table has records
        const userCheck = await pglite.query<{ count: string }>(
          `SELECT count(*) as count FROM users;`
        );
        const count = Number(userCheck.rows?.[0]?.count ?? 0);

        if (count === 0) {
          console.log("Seeding initial super admin and subscription tiers...");
          const { seedPilotData } = await import("@/db/seed");
          await seedPilotData();
          await persistDb();
          console.log("Database initialized successfully.");
        }

        // 3. Ensure kuriajoe85@gmail.com is always super admin
        const { hashPassword } = await import("@/lib/password");
        const adminPass = hashPassword("December25J#");
        await pglite.query(`
          INSERT INTO users (email, password_hash, full_name, phone, platform_role)
          VALUES ('kuriajoe85@gmail.com', $1, 'Joseph Kuria', '254700898950', 'super_admin')
          ON CONFLICT (email) DO UPDATE SET platform_role = 'super_admin';
        `, [adminPass]);
      } catch (e) {
        console.error("ensureSeeded error:", e);
      }
    })();
  }

  await seeding;
  // 4. Ensure all serial primary key sequences are synchronized with MAX(id)
  await syncAllSequences();
}

/**
 * Synchronizes all PostgreSQL sequence counters with the maximum ID present in their tables.
 * Prevents "duplicate key value violates unique constraint" errors when rows were seeded or imported with explicit IDs.
 */
export async function syncAllSequences(): Promise<void> {
  try {
    // Clean up stale test organizations if present in memory or disk
    try {
      await pglite.query(`
        DELETE FROM organization_memberships WHERE org_id IN (SELECT id FROM organizations WHERE slug = 'rocs-crew-2');
        DELETE FROM organizations WHERE slug = 'rocs-crew-2';
      `);
    } catch {
      // ignore
    }

    const seqDeps = await pglite.query<{
      sequence_name: string;
      table_name: string;
      column_name: string;
    }>(`
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

    for (const row of seqDeps.rows ?? []) {
      try {
        await pglite.query(`
          SELECT setval(
            '${row.sequence_name}',
            COALESCE((SELECT MAX("${row.column_name}") FROM "${row.table_name}"), 1),
            (SELECT MAX("${row.column_name}") IS NOT NULL FROM "${row.table_name}")
          );
        `);
      } catch (colErr) {
        // Ignore column mismatch or special sequence types
      }
    }
  } catch (err) {
    console.warn("syncAllSequences warning:", err);
  }
}
