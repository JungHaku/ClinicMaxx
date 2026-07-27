/**
 * Loads people scraped out of Jane into a ClinicMaxx database.
 *
 *   npm run db:import -- <file.json> [--db data/breathe.db] [--dry-run]
 *
 * Input shape (everything optional except what you are importing):
 *
 *   {
 *     "clinic":    { "name": "...", "phone": "...", "email": "...", "website": "..." },
 *     "locations": [{ "name": "...", "address": "...", "city": "...", "region": "..." }],
 *     "staff":     [{ "firstName": "...", "lastName": "...", "discipline": "Physiotherapy",
 *                     "credentials": "PT", "email": "...", "phone": "..." }],
 *     "patients":  [{ "firstName": "...", "lastName": "...", "email": "...", "phone": "...",
 *                     "dateOfBirth": "1980-01-31", "preferredName": "...", "janeId": "..." }]
 *   }
 *
 * Two properties matter more than anything else here:
 *
 *  · It is IDEMPOTENT. Scraping a long list gets interrupted, so this has to be
 *    safe to re-run. People are matched on a natural key and updated rather than
 *    duplicated — a patient record silently forked in two is worse than a failed
 *    import, because nobody notices until a clinician reads the wrong half.
 *
 *  · It NEVER seeds. It opens the database with CLINICMAXX_NO_SEED so the demo's
 *    480 invented patients cannot land in a real clinical file.
 */

import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "../src/lib/schema.ts";

const { DatabaseSync } = process.getBuiltinModule("node:sqlite");

/* ----------------------------------------------------------------- input */

interface JaneClinic { name?: string; tagline?: string; phone?: string; email?: string; website?: string }
interface JaneLocation { name: string; address?: string; city?: string; region?: string; postalCode?: string; phone?: string }
interface JaneStaff {
  firstName: string; lastName: string; discipline?: string; credentials?: string;
  email?: string; phone?: string; bio?: string; role?: string; onlineBooking?: boolean;
}
interface JanePatient {
  firstName: string; lastName: string; preferredName?: string; email?: string; phone?: string;
  dateOfBirth?: string; pronouns?: string; address?: string; city?: string; region?: string;
  postalCode?: string; emergencyName?: string; emergencyPhone?: string; occupation?: string;
  referralSource?: string; familyDoctor?: string; alert?: string; tags?: string; notes?: string;
  janeId?: string;
}
interface Payload {
  clinic?: JaneClinic;
  locations?: JaneLocation[];
  staff?: JaneStaff[];
  patients?: JanePatient[];
}

/* ------------------------------------------------------------------ args */

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const dryRun = argv.includes("--dry-run");
const dbArg = argv.indexOf("--db");
const dbPath = dbArg >= 0 ? argv[dbArg + 1] : process.env.CLINICMAXX_DB;

if (!file) {
  console.error("usage: npm run db:import -- <file.json> [--db data/real.db] [--dry-run]");
  process.exit(1);
}
if (!dbPath) {
  console.error("Refusing to run without an explicit --db. Real data must not land in the demo database.");
  process.exit(1);
}
if (path.resolve(dbPath) === path.resolve("data/clinicmaxx.db")) {
  console.error("Refusing to write into data/clinicmaxx.db — that is the demo database with 480 invented patients.");
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(file, "utf8")) as Payload;

fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(SCHEMA);

const today = new Date().toISOString().slice(0, 10);
const stats = { created: 0, updated: 0, skipped: 0 };
const note = (s: string) => console.log(`  ${s}`);

/* --------------------------------------------------------------- helpers */

const get = <T,>(sql: string, ...p: unknown[]) =>
  db.prepare(sql).get(...(p as never[])) as T | undefined;
const run = (sql: string, ...p: unknown[]) =>
  Number(db.prepare(sql).run(...(p as never[])).lastInsertRowid);

/** Normalised key for matching a person across runs. */
const personKey = (first: string, last: string, dob?: string, email?: string) =>
  [first, last, dob ?? "", email ?? ""].join("|").toLowerCase().replace(/\s+/g, " ").trim();

db.exec("BEGIN");
try {
  /* ---- clinic: the app will not render without exactly one row ---------- */
  const c = payload.clinic;
  const existingClinic = get<{ n: number }>("SELECT COUNT(*) AS n FROM clinic");
  if (!existingClinic || existingClinic.n === 0) {
    run(
      `INSERT INTO clinic (id,name,tagline,email,phone,website,timezone,currency,
         booking_lead_hours,cancellation_hours,cancellation_fee_cents,default_tax_bps,
         invoice_prefix,next_invoice_seq)
       VALUES (1,?,?,?,?,?,'America/Vancouver','CAD',2,24,4000,0,'CMX',1001)`,
      c?.name ?? "My Clinic", c?.tagline ?? "", c?.email ?? "", c?.phone ?? "", c?.website ?? "",
    );
    note(`clinic: created "${c?.name ?? "My Clinic"}"`);
  } else if (c?.name) {
    run("UPDATE clinic SET name=?, tagline=COALESCE(NULLIF(?,''),tagline), email=COALESCE(NULLIF(?,''),email), phone=COALESCE(NULLIF(?,''),phone), website=COALESCE(NULLIF(?,''),website) WHERE id=1",
      c.name, c.tagline ?? "", c.email ?? "", c.phone ?? "", c.website ?? "");
    note(`clinic: updated "${c.name}"`);
  }

  /* ---- locations -------------------------------------------------------- */
  for (const l of payload.locations ?? []) {
    const hit = get<{ id: number }>("SELECT id FROM locations WHERE LOWER(name)=LOWER(?)", l.name);
    if (hit) {
      run("UPDATE locations SET address=?,city=?,region=?,postal_code=?,phone=? WHERE id=?",
        l.address ?? "", l.city ?? "", l.region ?? "", l.postalCode ?? "", l.phone ?? "", hit.id);
      stats.updated++;
    } else {
      run("INSERT INTO locations (name,address,city,region,postal_code,phone) VALUES (?,?,?,?,?,?)",
        l.name, l.address ?? "", l.city ?? "", l.region ?? "", l.postalCode ?? "", l.phone ?? "");
      stats.created++;
    }
  }
  if (payload.locations?.length) note(`locations: ${payload.locations.length} processed`);

  /* ---- disciplines are derived from staff, never invented ---------------- */
  const disciplineId = (name: string): number => {
    const clean = name.trim() || "General";
    const hit = get<{ id: number }>("SELECT id FROM disciplines WHERE LOWER(name)=LOWER(?)", clean);
    if (hit) return hit.id;
    const palette = ["teal", "amber", "violet", "rose", "sky", "emerald", "orange", "indigo"];
    const n = get<{ n: number }>("SELECT COUNT(*) AS n FROM disciplines")!.n;
    return run("INSERT INTO disciplines (name,color,description) VALUES (?,?,'')",
      clean, palette[n % palette.length]);
  };

  /* ---- staff ------------------------------------------------------------ */
  for (const s of payload.staff ?? []) {
    if (!s.firstName && !s.lastName) { stats.skipped++; continue; }
    const did = disciplineId(s.discipline ?? "General");
    const hit = get<{ id: number }>(
      "SELECT id FROM practitioners WHERE LOWER(first_name)=LOWER(?) AND LOWER(last_name)=LOWER(?)",
      s.firstName, s.lastName,
    );
    if (hit) {
      run(`UPDATE practitioners SET credentials=COALESCE(NULLIF(?,''),credentials),
             discipline_id=?, email=COALESCE(NULLIF(?,''),email),
             phone=COALESCE(NULLIF(?,''),phone), bio=COALESCE(NULLIF(?,''),bio) WHERE id=?`,
        s.credentials ?? "", did, s.email ?? "", s.phone ?? "", s.bio ?? "", hit.id);
      stats.updated++;
    } else {
      run(`INSERT INTO practitioners (first_name,last_name,credentials,discipline_id,email,phone,bio,
             color,role,location_id,online_booking,is_active,started_on)
           VALUES (?,?,?,?,?,?,?,?,?,(SELECT id FROM locations ORDER BY id LIMIT 1),?,1,?)`,
        s.firstName, s.lastName, s.credentials ?? "", did, s.email ?? "", s.phone ?? "", s.bio ?? "",
        ["teal","amber","violet","rose","sky","emerald","orange","indigo"][stats.created % 8],
        s.role ?? "practitioner", s.onlineBooking === false ? 0 : 1, today);
      stats.created++;
    }
  }
  if (payload.staff?.length) note(`staff: ${payload.staff.length} processed`);

  /* ---- patients --------------------------------------------------------- */
  let pCreated = 0, pUpdated = 0, pSkipped = 0;
  const seen = new Set<string>();
  for (const p of payload.patients ?? []) {
    if (!p.firstName && !p.lastName) { pSkipped++; continue; }

    // Guard against the same person appearing twice in one scrape.
    const key = personKey(p.firstName, p.lastName, p.dateOfBirth, p.email);
    if (seen.has(key)) { pSkipped++; continue; }
    seen.add(key);

    // Match on the strongest signal available: DOB beats email beats name alone.
    let hit: { id: number } | undefined;
    if (p.dateOfBirth) {
      hit = get<{ id: number }>(
        "SELECT id FROM patients WHERE LOWER(first_name)=LOWER(?) AND LOWER(last_name)=LOWER(?) AND date_of_birth=?",
        p.firstName, p.lastName, p.dateOfBirth);
    }
    if (!hit && p.email) {
      hit = get<{ id: number }>("SELECT id FROM patients WHERE email<>'' AND LOWER(email)=LOWER(?)", p.email);
    }
    if (!hit) {
      hit = get<{ id: number }>(
        "SELECT id FROM patients WHERE LOWER(first_name)=LOWER(?) AND LOWER(last_name)=LOWER(?) AND date_of_birth=''",
        p.firstName, p.lastName);
    }

    const cols = {
      preferred_name: p.preferredName ?? "", email: p.email ?? "", phone: p.phone ?? "",
      date_of_birth: p.dateOfBirth ?? "", pronouns: p.pronouns ?? "", address: p.address ?? "",
      city: p.city ?? "", region: p.region ?? "", postal_code: p.postalCode ?? "",
      emergency_name: p.emergencyName ?? "", emergency_phone: p.emergencyPhone ?? "",
      occupation: p.occupation ?? "", referral_source: p.referralSource ?? "",
      family_doctor: p.familyDoctor ?? "", alert: p.alert ?? "", tags: p.tags ?? "",
      notes: p.notes ?? "",
    };

    if (hit) {
      // Only fill blanks; never overwrite a populated field with an empty scrape.
      const sets = Object.keys(cols).map((k) => `${k}=COALESCE(NULLIF(?,''),${k})`).join(",");
      run(`UPDATE patients SET ${sets} WHERE id=?`, ...Object.values(cols), hit.id);
      pUpdated++;
    } else {
      const keys = ["first_name", "last_name", ...Object.keys(cols)];
      run(`INSERT INTO patients (${keys.join(",")},intake_completed,consent_signed,is_active,created_at)
           VALUES (${keys.map(() => "?").join(",")},0,0,1,?)`,
        p.firstName, p.lastName, ...Object.values(cols), today);
      pCreated++;
    }
  }
  if (payload.patients?.length) {
    note(`patients: ${pCreated} created, ${pUpdated} updated, ${pSkipped} skipped`);
  }

  if (dryRun) {
    db.exec("ROLLBACK");
    note("DRY RUN — everything above was rolled back, nothing written.");
  } else {
    db.exec("COMMIT");
  }
} catch (e) {
  db.exec("ROLLBACK");
  console.error("\n  Import failed, database left untouched:\n   ", (e as Error).message, "\n");
  process.exit(1);
}

/* ---------------------------------------------------------------- report */

const count = (t: string) => get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`)!.n;
console.log(`\n  ${dryRun ? "Would contain" : "Database now holds"} — ${path.resolve(dbPath)}`);
for (const t of ["clinic", "locations", "disciplines", "practitioners", "patients"]) {
  console.log(`    ${String(count(t)).padStart(6)}  ${t}`);
}
console.log();
