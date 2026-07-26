/**
 * Standalone seeder: `npm run db:seed` (or `npm run db:reset` to start over).
 * The app also seeds automatically the first time it opens an empty database.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seed, seedSummary } from "../src/lib/seed.ts";
import { SCHEMA } from "../src/lib/schema.ts";

const root = process.cwd();
const dataDir = path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.CLINICMAXX_DB ?? path.join(dataDir, "clinicmaxx.db");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(SCHEMA);

const existing = db.prepare("SELECT COUNT(*) AS n FROM clinic").get() as { n: number };
if (existing.n > 0) {
  console.log("Database already seeded — run `npm run db:reset` to rebuild it from scratch.");
  process.exit(0);
}

const t0 = Date.now();
seed(db);
const summary = seedSummary(db);

console.log(`\n  ClinicMaxx demo clinic built in ${Date.now() - t0}ms\n`);
for (const [k, v] of Object.entries(summary)) {
  console.log(`    ${String(v).padStart(6)}  ${k}`);
}
console.log(`\n  → ${dbPath}\n`);
