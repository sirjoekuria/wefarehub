import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(process.cwd(), ".data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const tarPath = path.join(dataDir, "pgdata.tar");

function createInstance(): PGlite {
  if (fs.existsSync(tarPath)) {
    try {
      const buf = fs.readFileSync(tarPath);
      return new PGlite({ loadDataDir: new Blob([buf]) });
    } catch (e) {
      console.warn("Failed to load pgdata.tar, using in-memory fallback:", e);
    }
  }
  return new PGlite();
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaPglite?: PGlite;
  __arenaDrizzle?: ReturnType<typeof drizzle>;
};

export const pglite = globalForDb.__arenaPglite ?? createInstance();
export const db = globalForDb.__arenaDrizzle ?? drizzle(pglite);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaPglite = pglite;
  globalForDb.__arenaDrizzle = db;
}

/** Immediately persist database snapshot to disk so data is never lost */
export async function persistDb(): Promise<void> {
  try {
    const blob = await pglite.dumpDataDir();
    const buf = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(tarPath, buf);
  } catch (e) {
    console.error("Failed to immediately persist database snapshot:", e);
  }
}

/** Persist changes back to disk snapshot asynchronously without blocking queries */
let saveTimer: NodeJS.Timeout | null = null;
export function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    await persistDb();
  }, 500);
}

export const pool = {
  end: async () => {
    try {
      const blob = await pglite.dumpDataDir();
      const buf = Buffer.from(await blob.arrayBuffer());
      fs.writeFileSync(tarPath, buf);
      await pglite.close();
    } catch {
      // ignore
    }
  },
};
