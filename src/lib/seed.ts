import type { DatabaseSync } from "node:sqlite";

/* Date helpers are inlined rather than imported so this module stays runnable
 * straight from `node --experimental-strip-types scripts/seed.ts`. */
const pad = (n: number) => String(n).padStart(2, "0");

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addMinutes(stamp: string, mins: number): string {
  const [datePart, timePart] = stamp.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm + mins);
  return `${toDateKey(dt)}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

/* ------------------------------------------------------------------ *
 * Deterministic randomness — the demo clinic looks the same every time
 * a database is created, which makes screenshots and tests stable.
 * ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260725);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;
const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

/* ------------------------------------------------------------------ */

const DISCIPLINES = [
  ["Physiotherapy", "teal", "Movement assessment, manual therapy and rehab programming."],
  ["Massage Therapy", "amber", "Registered massage therapy for pain, tension and recovery."],
  ["Chiropractic", "violet", "Spinal and joint assessment, adjustment and mobilisation."],
  ["Acupuncture", "rose", "Traditional and contemporary medical acupuncture."],
  ["Counselling", "sky", "Registered clinical counselling and mental health support."],
  ["Administration", "slate", "Front desk, billing and clinic operations."],
] as const;

const PRACTITIONERS = [
  ["Elena", "Vasquez", "PT, MScPT", "Physiotherapy", "indigo", "owner", "2018-03-05",
   "Founded ClinicMaxx after a decade in hospital outpatient care. Special interest in post-surgical knee and shoulder rehab."],
  ["Amara", "Osei", "PT, FCAMPT", "Physiotherapy", "teal", "practitioner", "2019-09-16",
   "Manual therapy fellow with a caseload weighted toward persistent low back pain and return-to-sport testing."],
  ["Marcus", "Oyelaran", "PT, CAFCI", "Physiotherapy", "emerald", "practitioner", "2022-01-10",
   "Combines dry needling with graded loading for tendinopathy. Runs the clinic's running-gait clinic."],
  ["Daniel", "Reyes", "RMT", "Massage Therapy", "amber", "practitioner", "2020-06-01",
   "Deep tissue and myofascial release, with a steady base of desk-worker neck and shoulder clients."],
  ["Yuki", "Tanabe", "RMT", "Massage Therapy", "orange", "practitioner", "2023-02-13",
   "Prenatal and postpartum certified. Gentle, sustained-pressure style."],
  ["Priya", "Raghunathan", "DC", "Chiropractic", "violet", "practitioner", "2021-04-19",
   "Diversified and Activator technique. Sees a lot of cervicogenic headache and desk posture."],
  ["Nolan", "Fitzgerald", "R.Ac, TCMP", "Acupuncture", "rose", "practitioner", "2021-11-08",
   "Registered acupuncturist focusing on chronic pain, migraine and sleep."],
  ["Sarah", "Lindqvist", "RCC, MA", "Counselling", "sky", "practitioner", "2022-08-22",
   "Registered clinical counsellor. CBT and ACT for anxiety, chronic pain coping and burnout."],
  ["Robin", "Chase", "Practice Manager", "Administration", "slate", "admin", "2018-03-05",
   "Runs the front desk, insurance submissions and the clinic's reporting."],
] as const;

const TREATMENTS = [
  // name, discipline, minutes, price, online bookable, description
  ["Physiotherapy — Initial Assessment", "Physiotherapy", 60, 13500, 1, "Full history, movement screen and first treatment. Book this for any new condition."],
  ["Physiotherapy — Follow-up", "Physiotherapy", 30, 9500, 1, "Standard follow-up visit including manual therapy and exercise progression."],
  ["Physiotherapy — Extended Follow-up", "Physiotherapy", 45, 12000, 1, "Longer visit for complex or multi-region presentations."],
  ["Dry Needling — Add-on", "Physiotherapy", 15, 3000, 0, "Intramuscular stimulation added to an existing physiotherapy visit."],
  ["Vestibular Assessment", "Physiotherapy", 60, 15000, 1, "Dizziness and balance assessment including positional testing."],
  ["Running Gait Analysis", "Physiotherapy", 75, 18500, 1, "Treadmill video analysis with a written report and cadence plan."],

  ["Massage Therapy — 30 min", "Massage Therapy", 30, 6500, 1, "Focused treatment on a single region."],
  ["Massage Therapy — 45 min", "Massage Therapy", 45, 9000, 1, "Most popular length. One or two regions."],
  ["Massage Therapy — 60 min", "Massage Therapy", 60, 11500, 1, "Full treatment with time for postural work."],
  ["Massage Therapy — 90 min", "Massage Therapy", 90, 16500, 1, "Extended full-body treatment."],
  ["Prenatal Massage — 60 min", "Massage Therapy", 60, 12000, 1, "Side-lying prenatal treatment with bolstering."],

  ["Chiropractic — Initial Exam", "Chiropractic", 45, 12000, 1, "History, orthopaedic and neurological screen, first adjustment."],
  ["Chiropractic — Adjustment", "Chiropractic", 20, 7000, 1, "Standard adjustment visit."],
  ["Chiropractic — Re-assessment", "Chiropractic", 30, 9500, 1, "Progress review with outcome measures."],

  ["Acupuncture — Initial", "Acupuncture", 60, 11000, 1, "TCM intake, tongue and pulse assessment, first needling session."],
  ["Acupuncture — Follow-up", "Acupuncture", 45, 8500, 1, "Ongoing treatment following the initial plan."],
  ["Cupping Therapy", "Acupuncture", 30, 7000, 1, "Fire or silicone cupping for myofascial restriction."],

  ["Counselling — Intake", "Counselling", 60, 16000, 1, "First session: history, goals and fit."],
  ["Counselling — Individual", "Counselling", 50, 14500, 1, "Standard 50-minute individual session."],
  ["Counselling — Couples", "Counselling", 75, 20500, 1, "Session for two participants."],
] as const;

const PRODUCTS = [
  ["Kinesiology Tape (5m roll)", "KT-5M", 2200, 900, 34],
  ["TheraBand — Medium", "TB-MED", 1800, 600, 51],
  ["Foam Roller — 36\"", "FR-36", 5900, 2600, 12],
  ["Massage Oil — Unscented 250ml", "MO-250", 2400, 1000, 22],
  ["Orthotic Insoles — Full Length", "OI-FL", 8900, 4200, 8],
  ["Acupressure Mat", "AP-MAT", 6500, 2900, 6],
  ["Reusable Gel Ice Pack", "GP-STD", 1900, 700, 27],
  ["Resistance Band Set (3)", "RB-SET3", 3400, 1400, 19],
] as const;

const FIRST_NAMES = [
  "Olivia","Liam","Emma","Noah","Ava","Ethan","Sophia","Mason","Isabella","Lucas",
  "Mia","Jack","Charlotte","Henry","Amelia","Owen","Harper","Leo","Evelyn","Felix",
  "Aisha","Rohan","Mei","Diego","Zara","Kwame","Ingrid","Tomas","Nadia","Hugo",
  "Priyanka","Sean","Fatima","Andre","Bianca","Yusuf","Clara","Malik","Rosa","Ivan",
  "Simone","Dermot","Anika","Teo","Greta","Cyrus","Lena","Otis","Freya","Rashid",
  "Callum","Mira","Jonas","Delphine","Kai","Naomi","Arturo","Sinead","Bo","Wren",
] as const;

const LAST_NAMES = [
  "Whitfield","Nakamura","Okonkwo","Petrov","Delacroix","Silva","Andersen","Rahman","Torres","Kaur",
  "Lindgren","Mbeki","Fontaine","Halvorsen","Castellanos","Novak","Bergström","Iqbal","Moreau","Vaszary",
  "Kowalski","Abara","Ferreira","Lindholm","Sandoval","Quinn","Bakshi","Marchetti","Olawale","Ceballos",
  "Thoreau","Mwangi","Dubois","Larsen","Escobar","Hutchings","Nilsson","Farooq","Beaulieu","Ivarsson",
  "Sørensen","Adeyemi","Rossi","Kovács","Palmer","Ngata","Brandt","Salcedo","Vermeulen","Choi",
  "Aldridge","Boateng","Cardoso","Dhaliwal","Eriksen","Fitzpatrick","Gagnon","Hollingsworth","Ibrahim","Jayawardena",
  "Klimenko","Lundqvist","Mikhailov","Nordstrom","Ostrowski","Pemberton","Quintero","Ramachandran","Sinclair","Tremblay",
  "Underhill","Villanueva","Wojcik","Xiang","Yamamoto","Zielinski","Achterberg","Bouchard","Caruana","Devlin",
  "Ekwueme","Fairbanks","Gallagher","Haugen","Ivanković","Jorgensen","Kristensen","Lemieux","Mahmood","Nwachukwu",
  "Oyelaran","Pfeiffer","Quirke","Rasmussen","Stavros","Toussaint","Ulrich","Voskuijl","Whitlock","Yakubu",
  "Ashworth","Berkowitz","Chaudhry","Doherty","Engström","Fernández","Grimaldi","Hasegawa","Ingebrigtsen","Jankowski",
] as const;

const INSURERS = [
  ["Pacific Blue Cross", "extended", 80, 60000],
  ["Sun Life Financial", "extended", 80, 75000],
  ["Manulife", "extended", 100, 50000],
  ["Canada Life", "extended", 90, 40000],
  ["Green Shield Canada", "extended", 80, 55000],
  ["Desjardins Insurance", "extended", 70, 45000],
  ["ICBC", "mva", 100, 0],
  ["WorkSafeBC", "wcb", 100, 0],
] as const;

const REFERRALS = [
  "Google search","Family doctor","Word of mouth","Instagram","Returning client",
  "Walk-in","Corporate benefits plan","Physiotherapy referral","ICBC adjuster","Yelp",
] as const;

const OCCUPATIONS = [
  "Software developer","Registered nurse","Teacher","Carpenter","Barista","Accountant",
  "Warehouse associate","Graphic designer","Firefighter","Retired","Student","Chef",
  "Delivery driver","Dental hygienist","Landscaper","Project manager","Hairstylist","Electrician",
] as const;

const CONDITIONS = [
  "R shoulder impingement","L knee OA","chronic low back pain","cervicogenic headache",
  "lateral epicondylalgia","plantar fasciopathy","post-op ACL reconstruction","whiplash (MVA)",
  "rotator cuff tendinopathy","hip bursitis","sciatica","TMJ dysfunction","frozen shoulder",
  "Achilles tendinopathy","patellofemoral pain","thoracic outlet symptoms","de Quervain's",
  "generalised anxiety","work-related burnout","sleep disturbance","migraine",
] as const;

const CITIES = [
  ["Vancouver","BC"],["Burnaby","BC"],["North Vancouver","BC"],["Richmond","BC"],
  ["New Westminster","BC"],["Coquitlam","BC"],["Surrey","BC"],
] as const;

/* ------------------------------------------------------------------ */

export function seed(db: DatabaseSync) {
  const ins = (sql: string, ...p: unknown[]) =>
    Number(db.prepare(sql).run(...(p as never[])).lastInsertRowid);
  const rows = <T,>(sql: string, ...p: unknown[]) =>
    db.prepare(sql).all(...(p as never[])) as T[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const TODAY = toDateKey(today);

  db.exec("BEGIN");

  /* ---- clinic + locations -------------------------------------- */
  ins(
    `INSERT INTO clinic (id,name,tagline,email,phone,website,timezone,currency,
       booking_lead_hours,cancellation_hours,cancellation_fee_cents,default_tax_bps,invoice_prefix,next_invoice_seq)
     VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    "ClinicMaxx Health Collective",
    "Multi-disciplinary care, one calendar.",
    "hello@clinicmaxx.health",
    "(604) 555-0182",
    "clinicmaxx.health",
    "America/Vancouver",
    "CAD",
    2,
    24,
    4000,
    0,
    "CMX",
    1001,
  );

  const mainLoc = ins(
    "INSERT INTO locations (name,address,city,region,postal_code,phone) VALUES (?,?,?,?,?,?)",
    "Mount Pleasant", "218 East 8th Avenue, Unit 200", "Vancouver", "BC", "V5T 1S1", "(604) 555-0182",
  );
  const northLoc = ins(
    "INSERT INTO locations (name,address,city,region,postal_code,phone) VALUES (?,?,?,?,?,?)",
    "North Shore", "1450 Marine Drive, Suite 5", "North Vancouver", "BC", "V7P 1T7", "(604) 555-0199",
  );

  /* ---- disciplines --------------------------------------------- */
  const discId: Record<string, number> = {};
  for (const [name, color, description] of DISCIPLINES) {
    discId[name] = ins(
      "INSERT INTO disciplines (name,color,description) VALUES (?,?,?)",
      name, color, description,
    );
  }

  /* ---- practitioners + availability ---------------------------- */
  const pracIds: number[] = [];
  for (const [first, last, creds, disc, color, role, started, bio] of PRACTITIONERS) {
    const locId = last === "Tanabe" || last === "Fitzgerald" ? northLoc : mainLoc;
    const id = ins(
      `INSERT INTO practitioners (first_name,last_name,credentials,discipline_id,email,phone,bio,color,role,location_id,online_booking,is_active,started_on)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?)`,
      first, last, creds, discId[disc],
      `${first.toLowerCase()}@clinicmaxx.health`,
      `(604) 555-0${between(100, 199)}`,
      bio, color, role, locId,
      role === "admin" ? 0 : 1,
      started,
    );
    pracIds.push(id);

    // Everyone takes one weekday off; the clinic keeps a thin weekend roster.
    const dayOff = pick([1, 2, 3, 4, 5] as const);
    const worksSaturday = chance(0.5);
    const worksSunday = chance(0.35);
    for (let wd = 0; wd <= 6; wd++) {
      if (wd === dayOff) continue;
      if (wd === 0 && !worksSunday) continue;
      if (wd === 6 && !worksSaturday) continue;
      const weekend = wd === 0 || wd === 6;
      const start = weekend ? 9 * 60 : pick([8 * 60, 8 * 60 + 30, 9 * 60, 10 * 60] as const);
      const end = weekend
        ? start + pick([5 * 60, 6 * 60] as const)
        : start + pick([8 * 60, 8 * 60 + 30, 7 * 60] as const);
      ins(
        "INSERT INTO availability (practitioner_id,location_id,weekday,start_min,end_min) VALUES (?,?,?,?,?)",
        id, locId, wd, start, end,
      );
    }
  }

  /* ---- treatments ---------------------------------------------- */
  const treatIds: Record<string, number> = {};
  for (const [name, disc, mins, price, online, description] of TREATMENTS) {
    treatIds[name] = ins(
      `INSERT INTO treatments (name,discipline_id,duration_min,price_cents,tax_bps,description,online_bookable)
       VALUES (?,?,?,?,0,?,?)`,
      name, discId[disc], mins, price, description, online,
    );
  }

  // Every practitioner offers everything in their own discipline.
  const pracRows = rows<{ id: number; discipline_id: number }>(
    "SELECT id, discipline_id FROM practitioners",
  );
  const treatRows = rows<{ id: number; discipline_id: number; duration_min: number; price_cents: number; name: string }>(
    "SELECT id, discipline_id, duration_min, price_cents, name FROM treatments",
  );
  for (const p of pracRows) {
    for (const t of treatRows) {
      if (t.discipline_id === p.discipline_id) {
        ins(
          "INSERT INTO practitioner_treatments (practitioner_id,treatment_id) VALUES (?,?)",
          p.id, t.id,
        );
      }
    }
  }

  for (const [name, sku, price, cost, stock] of PRODUCTS) {
    ins(
      "INSERT INTO products (name,sku,price_cents,cost_cents,stock,tax_bps) VALUES (?,?,?,?,?,1200)",
      name, sku, price, cost, stock,
    );
  }

  /* ---- chart templates ----------------------------------------- */
  const soapFields = JSON.stringify([
    { key: "subjective", label: "Subjective", type: "textarea", placeholder: "Client report since last visit, aggravating and easing factors, pain rating…" },
    { key: "objective", label: "Objective", type: "textarea", placeholder: "Observation, ROM, strength, special tests, palpation findings…" },
    { key: "assessment", label: "Assessment", type: "textarea", placeholder: "Clinical impression and stage of healing…" },
    { key: "plan", label: "Plan", type: "textarea", placeholder: "Treatment delivered today, home programme, next visit…" },
    { key: "pain", label: "Pain (0–10)", type: "scale" },
  ]);
  const massageFields = JSON.stringify([
    { key: "presentation", label: "Presentation", type: "textarea", placeholder: "Areas of complaint, tension patterns, contraindications screened…" },
    { key: "treatment", label: "Treatment Delivered", type: "textarea", placeholder: "Techniques, regions, pressure, positioning…" },
    { key: "response", label: "Response to Treatment", type: "textarea" },
    { key: "homecare", label: "Homecare", type: "textarea", placeholder: "Stretches, hydration, heat/ice…" },
    { key: "pain", label: "Pain (0–10)", type: "scale" },
  ]);
  const acuFields = JSON.stringify([
    { key: "tcm", label: "TCM Assessment", type: "textarea", placeholder: "Tongue, pulse, pattern differentiation…" },
    { key: "points", label: "Points Used", type: "textarea", placeholder: "LI4, LV3, GB20, retained 20 min…" },
    { key: "response", label: "Response", type: "textarea" },
    { key: "plan", label: "Plan", type: "textarea" },
  ]);
  const counsellingFields = JSON.stringify([
    { key: "focus", label: "Session Focus", type: "textarea" },
    { key: "interventions", label: "Interventions", type: "textarea", placeholder: "CBT thought record, ACT defusion, psychoeducation…" },
    { key: "risk", label: "Risk Screen", type: "text", placeholder: "No current SI/HI reported" },
    { key: "plan", label: "Plan / Homework", type: "textarea" },
  ]);
  const intakeFields = JSON.stringify([
    { key: "history", label: "Presenting History", type: "textarea" },
    { key: "medical", label: "Medical History & Medications", type: "textarea" },
    { key: "redflags", label: "Red Flag Screen", type: "textarea", placeholder: "Bowel/bladder, night pain, unexplained weight loss, saddle anaesthesia…" },
    { key: "goals", label: "Client Goals", type: "textarea" },
    { key: "consent", label: "Informed consent obtained", type: "checkbox" },
  ]);
  const dischargeFields = JSON.stringify([
    { key: "summary", label: "Course of Care Summary", type: "textarea" },
    { key: "outcome", label: "Outcome Measures", type: "textarea" },
    { key: "advice", label: "Discharge Advice", type: "textarea" },
  ]);

  const tplSoap = ins(
    "INSERT INTO chart_templates (name,discipline_id,kind,fields_json) VALUES (?,?,?,?)",
    "Physiotherapy SOAP", discId["Physiotherapy"], "soap", soapFields,
  );
  const tplChiro = ins(
    "INSERT INTO chart_templates (name,discipline_id,kind,fields_json) VALUES (?,?,?,?)",
    "Chiropractic SOAP", discId["Chiropractic"], "soap", soapFields,
  );
  const tplMassage = ins(
    "INSERT INTO chart_templates (name,discipline_id,kind,fields_json) VALUES (?,?,?,?)",
    "Massage Treatment Record", discId["Massage Therapy"], "soap", massageFields,
  );
  const tplAcu = ins(
    "INSERT INTO chart_templates (name,discipline_id,kind,fields_json) VALUES (?,?,?,?)",
    "Acupuncture Session Note", discId["Acupuncture"], "soap", acuFields,
  );
  const tplCouns = ins(
    "INSERT INTO chart_templates (name,discipline_id,kind,fields_json) VALUES (?,?,?,?)",
    "Counselling Progress Note", discId["Counselling"], "soap", counsellingFields,
  );
  ins(
    "INSERT INTO chart_templates (name,discipline_id,kind,fields_json) VALUES (?,NULL,?,?)",
    "New Client Intake & Consent", "intake", intakeFields,
  );
  ins(
    "INSERT INTO chart_templates (name,discipline_id,kind,fields_json) VALUES (?,NULL,?,?)",
    "Discharge Summary", "discharge", dischargeFields,
  );

  const templateForDiscipline: Record<number, number> = {
    [discId["Physiotherapy"]]: tplSoap,
    [discId["Chiropractic"]]: tplChiro,
    [discId["Massage Therapy"]]: tplMassage,
    [discId["Acupuncture"]]: tplAcu,
    [discId["Counselling"]]: tplCouns,
  };

  /* ---- patients ------------------------------------------------- */
  // Sized so the appointment volume below works out to a believable ~10–15
  // completed visits per client across the seeded history.
  const PATIENT_COUNT = 480;
  const patientIds: number[] = [];
  const patientCondition: Record<number, string> = {};
  const usedNames = new Set<string>();

  for (let i = 0; i < PATIENT_COUNT; i++) {
    let first = pick(FIRST_NAMES);
    let last = pick(LAST_NAMES);
    while (usedNames.has(`${first} ${last}`)) {
      first = pick(FIRST_NAMES);
      last = pick(LAST_NAMES);
    }
    usedNames.add(`${first} ${last}`);

    const [city, region] = pick(CITIES);
    const birthYear = between(1948, 2010);
    const dob = `${birthYear}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`;
    const createdDaysAgo = between(5, 900);
    const created = new Date(today);
    created.setDate(created.getDate() - createdDaysAgo);

    const tags: string[] = [];
    if (chance(0.18)) tags.push("MVA");
    if (chance(0.12)) tags.push("WCB");
    if (chance(0.25)) tags.push("Direct bill");
    if (createdDaysAgo < 45) tags.push("New client");
    if (chance(0.1)) tags.push("VIP");

    const alert = chance(0.14)
      ? pick([
          "Latex allergy — use nitrile gloves.",
          "Prefers no neck manipulation.",
          "Anticoagulant therapy — avoid deep pressure over limbs.",
          "Hard of hearing; face the client when speaking.",
          "Card on file declined — collect payment at desk.",
          "Pregnant, 2nd trimester — side-lying only.",
        ] as const)
      : "";

    const id = ins(
      `INSERT INTO patients (first_name,last_name,preferred_name,email,phone,date_of_birth,pronouns,
        address,city,region,postal_code,emergency_name,emergency_phone,occupation,referral_source,
        family_doctor,alert,tags,notes,intake_completed,consent_signed,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      first, last,
      chance(0.15) ? first.slice(0, 3) : "",
      `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
      `(${pick(["604", "778", "236"] as const)}) 555-${String(between(1000, 9999))}`,
      dob,
      pick(["she/her", "he/him", "they/them", "", "", ""] as const),
      `${between(100, 4999)} ${pick(["Cambie St", "Main St", "Broadway", "Commercial Dr", "Lonsdale Ave", "Granville St", "Hastings St", "Oak St"] as const)}`,
      city, region,
      `V${between(5, 7)}${pick(["A", "B", "C", "K", "T"] as const)} ${between(1, 9)}${pick(["A", "B", "G", "M"] as const)}${between(1, 9)}`,
      `${pick(FIRST_NAMES)} ${last}`,
      `(604) 555-${String(between(1000, 9999))}`,
      pick(OCCUPATIONS),
      pick(REFERRALS),
      chance(0.6) ? `Dr. ${pick(LAST_NAMES)}` : "",
      alert,
      tags.join(","),
      "",
      chance(0.92) ? 1 : 0,
      chance(0.95) ? 1 : 0,
      toDateKey(created),
    );
    patientIds.push(id);
    patientCondition[id] = pick(CONDITIONS);

    // Insurance: most clients carry extended health.
    if (chance(0.78)) {
      const [insurer, plan, coverage, annualMax] = pick(INSURERS);
      const usedPct = rnd();
      ins(
        `INSERT INTO insurance_policies (patient_id,insurer_name,plan_type,policy_number,member_id,
           coverage_percent,annual_max_cents,used_cents,visits_allowed,visits_used,direct_billing,is_primary,valid_to)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?)`,
        id, insurer, plan,
        `${String(between(100000, 999999))}`,
        `${pick(["A", "B", "M", "X"] as const)}${between(1000000, 9999999)}`,
        coverage,
        annualMax || 0,
        annualMax ? Math.round(annualMax * usedPct * 0.7) : 0,
        plan === "extended" ? 0 : between(8, 25),
        plan === "extended" ? 0 : between(0, 8),
        chance(0.7) ? 1 : 0,
        `${new Date().getFullYear()}-12-31`,
      );
      // A minority carry a spouse's secondary plan.
      if (chance(0.14)) {
        const [ins2, plan2, cov2, max2] = pick(INSURERS);
        ins(
          `INSERT INTO insurance_policies (patient_id,insurer_name,plan_type,policy_number,member_id,
             coverage_percent,annual_max_cents,used_cents,direct_billing,is_primary,valid_to)
           VALUES (?,?,?,?,?,?,?,?,0,0,?)`,
          id, ins2, plan2, `${between(100000, 999999)}`, `S${between(1000000, 9999999)}`,
          cov2, max2 || 0, 0, `${new Date().getFullYear()}-12-31`,
        );
      }
    }
  }

  /* ---- appointments, invoices, payments, claims, notes ---------- */
  const availRows = rows<{ practitioner_id: number; weekday: number; start_min: number; end_min: number; location_id: number }>(
    "SELECT practitioner_id, weekday, start_min, end_min, location_id FROM availability",
  );
  const pracTreatments = new Map<number, typeof treatRows>();
  for (const p of pracRows) {
    pracTreatments.set(p.id, treatRows.filter((t) => t.discipline_id === p.discipline_id));
  }
  const pracDiscipline = new Map(pracRows.map((p) => [p.id, p.discipline_id]));

  // Each patient sticks with one or two practitioners, the way real caseloads work.
  const bookablePracs = pracRows.filter((p) => pracTreatments.get(p.id)!.length > 0);
  const patientPrac: Record<number, number[]> = {};
  for (const pid of patientIds) {
    const primary = pick(bookablePracs).id;
    const list = [primary];
    if (chance(0.35)) {
      const second = pick(bookablePracs).id;
      if (second !== primary) list.push(second);
    }
    patientPrac[pid] = list;
  }

  let invoiceSeq = 1001;
  const patientVisitCount: Record<number, number> = {};
  const bookedOnDay = new Set<string>();

  const DAYS_BACK = 150;
  const DAYS_FORWARD = 28;

  for (let offset = -DAYS_BACK; offset <= DAYS_FORWARD; offset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + offset);
    const dayKey = toDateKey(day);
    const weekday = day.getDay();
    const isPast = offset < 0;
    const isToday = offset === 0;

    for (const av of availRows.filter((a) => a.weekday === weekday)) {
      const treatments = pracTreatments.get(av.practitioner_id)!;
      if (!treatments.length) continue;

      // Fill the day's column with back-to-back-ish bookings and natural gaps.
      let cursor = av.start_min;
      // Later dates are progressively emptier — the future books up as it approaches.
      const fillRate = offset < 0 ? 0.82 : offset < 7 ? 0.7 : offset < 14 ? 0.45 : 0.22;

      while (cursor < av.end_min - 20) {
        // Lunch gap around midday.
        if (cursor >= 12 * 60 && cursor < 12 * 60 + 45) {
          cursor = 12 * 60 + 45;
          continue;
        }
        if (!chance(fillRate)) {
          cursor += 15;
          continue;
        }

        const treatment = pick(treatments);
        if (treatment.name.includes("Add-on")) {
          cursor += 15;
          continue;
        }
        if (cursor + treatment.duration_min > av.end_min) break;

        // Prefer a patient already attached to this practitioner, and never
        // book the same person twice in one day.
        const candidates = patientIds.filter(
          (pid) => patientPrac[pid].includes(av.practitioner_id) && !bookedOnDay.has(`${dayKey}:${pid}`),
        );
        const pool = candidates.length
          ? candidates
          : patientIds.filter((pid) => !bookedOnDay.has(`${dayKey}:${pid}`));
        if (!pool.length) break;
        const patientId = pick(pool);
        bookedOnDay.add(`${dayKey}:${patientId}`);

        const startStamp = `${dayKey}T${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
        const endStamp = addMinutes(startStamp, treatment.duration_min);

        patientVisitCount[patientId] = (patientVisitCount[patientId] ?? 0) + 1;
        const isFirst = patientVisitCount[patientId] === 1 ? 1 : 0;

        let status: string;
        if (isPast) {
          const r = rnd();
          status = r < 0.88 ? "completed" : r < 0.945 ? "cancelled" : "no_show";
        } else if (isToday) {
          const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
          status = cursor + treatment.duration_min < nowMin
            ? "completed"
            : cursor <= nowMin
              ? "arrived"
              : "booked";
        } else {
          status = "booked";
        }

        const source = chance(0.42) ? "online" : "staff";
        const apptId = ins(
          `INSERT INTO appointments (patient_id,practitioner_id,treatment_id,location_id,starts_at,ends_at,
             status,source,is_first_visit,notes,cancel_reason,reminder_sent,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          patientId, av.practitioner_id, treatment.id, av.location_id,
          startStamp, endStamp, status, source, isFirst,
          chance(0.18) ? pick([
            "Client asked for extra time on the R shoulder.",
            "Parking validation given.",
            "Follow-up on home programme adherence.",
            "Bring orthotics to this visit.",
            "Insurance card updated at last visit.",
          ] as const) : "",
          status === "cancelled"
            ? pick(["Client illness", "Work conflict", "Rescheduled", "Weather", "Childcare"] as const)
            : "",
          isPast || isToday ? 1 : chance(0.5) ? 1 : 0,
          dayKey,
        );

        cursor += treatment.duration_min + (chance(0.25) ? 15 : 0);

        /* ---- billing for completed visits ---- */
        if (status !== "completed") continue;

        const policy = rows<{ id: number; insurer_name: string; coverage_percent: number; direct_billing: number }>(
          "SELECT id, insurer_name, coverage_percent, direct_billing FROM insurance_policies WHERE patient_id = ? AND is_primary = 1",
          patientId,
        )[0];

        const items: Array<{ kind: string; desc: string; qty: number; unit: number; tax: number; tId: number | null; pId: number | null }> = [
          { kind: "treatment", desc: treatment.name, qty: 1, unit: treatment.price_cents, tax: 0, tId: treatment.id, pId: null },
        ];
        // Occasional retail add-on.
        if (chance(0.09)) {
          const prod = rows<{ id: number; name: string; price_cents: number; tax_bps: number }>(
            "SELECT id,name,price_cents,tax_bps FROM products ORDER BY id",
          );
          const p = prod[Math.floor(rnd() * prod.length)];
          items.push({ kind: "product", desc: p.name, qty: 1, unit: p.price_cents, tax: p.tax_bps, tId: null, pId: p.id });
        }

        const subtotal = items.reduce((s, it) => s + it.unit * it.qty, 0);
        const tax = items.reduce((s, it) => s + Math.round((it.unit * it.qty * it.tax) / 10000), 0);
        const total = subtotal + tax;

        const number = `CMX-${invoiceSeq++}`;
        const invoiceId = ins(
          `INSERT INTO invoices (number,patient_id,appointment_id,issued_on,due_on,status,
             subtotal_cents,tax_cents,total_cents,paid_cents,notes)
           VALUES (?,?,?,?,?,?,?,?,?,0,'')`,
          number, patientId, apptId, dayKey, dayKey, "unpaid", subtotal, tax, total,
        );
        for (const it of items) {
          ins(
            `INSERT INTO invoice_items (invoice_id,kind,description,quantity,unit_cents,tax_bps,amount_cents,treatment_id,product_id)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            invoiceId, it.kind, it.desc, it.qty, it.unit, it.tax, it.unit * it.qty, it.tId, it.pId,
          );
        }
        db.prepare("UPDATE appointments SET invoice_id = ? WHERE id = ?").run(invoiceId, apptId);

        // Insurance portion via direct billing, then the client portion.
        let paid = 0;
        if (policy && policy.direct_billing && chance(0.85)) {
          const billed = treatment.price_cents;
          const approved = Math.round((billed * policy.coverage_percent) / 100);
          const daysSince = -offset;
          const claimStatus = daysSince > 10 ? "paid" : daysSince > 3 ? "accepted" : "submitted";
          const claimPaid = claimStatus === "paid" ? approved : 0;
          ins(
            `INSERT INTO claims (invoice_id,patient_id,policy_id,insurer_name,submitted_on,responded_on,status,
               billed_cents,approved_cents,paid_cents,adjudication)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            invoiceId, patientId, policy.id, policy.insurer_name, dayKey,
            claimStatus === "submitted" ? "" : dayKey,
            claimStatus, billed, approved, claimPaid,
            claimStatus === "paid" ? "Paid in full to provider." : claimStatus === "accepted" ? "Approved, remittance pending." : "",
          );
          if (claimPaid > 0) {
            ins(
              `INSERT INTO payments (invoice_id,patient_id,amount_cents,method,reference,received_on,note)
               VALUES (?,?,?,?,?,?,?)`,
              invoiceId, patientId, claimPaid, "insurer",
              `EFT-${between(100000, 999999)}`, dayKey, `${policy.insurer_name} direct billing`,
            );
            paid += claimPaid;
          }
        }

        const remaining = total - paid;
        if (remaining > 0 && chance(0.87)) {
          ins(
            `INSERT INTO payments (invoice_id,patient_id,amount_cents,method,reference,received_on,note)
             VALUES (?,?,?,?,?,?,'')`,
            invoiceId, patientId, remaining,
            pick(["card", "card", "card", "cash", "etransfer"] as const),
            chance(0.8) ? `••••${between(1000, 9999)}` : "",
            dayKey,
          );
          paid += remaining;
        }

        const status2 = paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";
        db.prepare("UPDATE invoices SET paid_cents = ?, status = ? WHERE id = ?").run(paid, status2, invoiceId);

        /* ---- chart note ---- */
        const discipline = pracDiscipline.get(av.practitioner_id)!;
        const tpl = templateForDiscipline[discipline];
        if (tpl && chance(0.84)) {
          const cond = patientCondition[patientId];
          const painNow = between(1, 7);
          let body: Record<string, string>;
          if (tpl === tplMassage) {
            body = {
              presentation: `Reports ${cond}. Tension through upper trapezius and levator scapulae bilaterally, worse on the ${pick(["right", "left"] as const)}. No contraindications identified today.`,
              treatment: `Supine and prone. Myofascial release to thoracolumbar fascia, trigger point therapy to upper trap, ${pick(["Swedish", "deep tissue", "sustained compression"] as const)} through the posterior chain. Pressure 6/10 as tolerated.`,
              response: `Tissue softened well through the session. Client reported reduced tightness on standing re-check.`,
              homecare: `Doorway pec stretch 3× daily, hydration, heat to the upper back this evening.`,
              pain: String(painNow),
            };
          } else if (tpl === tplAcu) {
            body = {
              tcm: `Tongue pale with thin white coat, teeth marks laterally. Pulse wiry on the left guan. Pattern: Liver Qi stagnation with underlying Spleen Qi deficiency. Presenting with ${cond}.`,
              points: `LI4, LV3 (four gates), GB20, BL23, SP6, ST36. Retained 22 minutes with gentle even technique. Warming needle at BL23.`,
              response: `Deqi achieved at all points. Client relaxed, reported warmth through the lumbar region.`,
              plan: `Weekly × 4, then reassess. Encouraged evening walk and reduced caffeine after noon.`,
            };
          } else if (tpl === tplCouns) {
            body = {
              focus: `Continued work on ${pick(["sleep hygiene", "workplace boundaries", "pain-related catastrophising", "panic cycle mapping"] as const)}. Client reported a ${pick(["moderate", "slight", "notable"] as const)} improvement since last session.`,
              interventions: `Reviewed thought record from the week. Cognitive restructuring around the "if I rest I fall behind" belief. Introduced values card sort and brief diaphragmatic breathing practice in session.`,
              risk: `No current SI/HI reported. Sleeping 6–7 hrs. Support network intact.`,
              plan: `Two thought records before next session. Continue 10-minute wind-down routine. Next session in 2 weeks.`,
            };
          } else {
            body = {
              subjective: `Client reports ${cond}. Pain ${painNow}/10 today, ${pick(["improving", "unchanged", "variable"] as const)} since last visit. Aggravated by ${pick(["prolonged sitting", "overhead reaching", "stairs", "first steps in the morning", "driving"] as const)}; eased by ${pick(["movement", "heat", "rest", "the home programme"] as const)}. Sleeping through the night ${chance(0.5) ? "without" : "with occasional"} disturbance.`,
              objective: `AROM ${pick(["full and pain-free at end range", "restricted 20% with pain at end range", "full with a painful arc"] as const)}. Strength ${pick(["4+/5", "4/5", "5/5"] as const)} in the involved group. ${pick(["Hawkins-Kennedy", "Slump test", "SLR", "Thomas test", "Ober's"] as const)} ${chance(0.5) ? "positive" : "negative"}. Palpation reproduces familiar symptoms over the ${pick(["supraspinatus insertion", "L4/5 facet", "common extensor origin", "medial joint line", "plantar fascia origin"] as const)}.`,
              assessment: `Consistent with ${cond}, ${pick(["subacute", "chronic", "acute-on-chronic"] as const)} stage. Responding as expected to loading. Prognosis good over 4–6 weeks with adherence.`,
              plan: `Today: manual therapy to the involved segment, ${pick(["soft tissue release", "grade III mobilisations", "dry needling to the involved muscle", "taping"] as const)}, and exercise progression. Home programme updated to ${between(2, 4)} exercises. Review in ${pick(["1 week", "10 days", "2 weeks"] as const)}.`,
              pain: String(painNow),
            };
          }
          const noteTitle = treatment.name.split("—")[0].trim();
          ins(
            `INSERT INTO chart_notes (patient_id,practitioner_id,appointment_id,template_id,title,body_json,status,signed_at,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            patientId, av.practitioner_id, apptId, tpl,
            `${noteTitle} — ${dayKey}`,
            JSON.stringify(body),
            chance(0.94) ? "signed" : "draft",
            chance(0.94) ? `${endStamp}` : "",
            endStamp, endStamp,
          );
        }
      }
    }
  }

  /* ---- communications ------------------------------------------ */
  for (const pid of patientIds) {
    const n = between(0, 4);
    for (let i = 0; i < n; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - between(1, 120));
      const kind = pick(["email", "sms", "call", "note"] as const);
      const [subject, body] = kind === "email"
        ? ["Appointment reminder", "Automated reminder sent 24 hours before the booking. Delivered."]
        : kind === "sms"
          ? ["SMS reminder", "Reply C to confirm — client confirmed."]
          : kind === "call"
            ? ["Inbound call", pick([
                "Called to ask whether we direct bill their plan. Confirmed we do.",
                "Rescheduling request — moved to the following week.",
                "Asked for a receipt for their extended health claim. Emailed.",
              ] as const)]
            : ["Front desk note", pick([
                "Card on file expired; asked client to update at next visit.",
                "Prefers afternoon appointments where possible.",
                "Requested the same treatment room as last time.",
              ] as const)];
      ins(
        "INSERT INTO communications (patient_id,kind,direction,subject,body,author,created_at) VALUES (?,?,?,?,?,?,?)",
        pid, kind, kind === "call" ? "in" : "out", subject, body,
        pick(["Robin Chase", "Automated", "Robin Chase"] as const), toDateKey(d),
      );
    }
  }

  /* ---- tasks ---------------------------------------------------- */
  const taskTemplates: Array<[string, string]> = [
    ["Submit outstanding ICBC claim", "Part 7 form still needs the practitioner signature before we can submit."],
    ["Follow up on unpaid balance", "Two visits unpaid past 30 days. Send a statement and offer a payment plan."],
    ["Chase missing intake form", "Client booked online but has not completed the intake questionnaire."],
    ["Call to rebook after no-show", "Missed last week's appointment. Waive the fee once, then rebook."],
    ["Update expired credit card", "Card on file declined at checkout."],
    ["Send discharge summary to family doctor", "Client consented to sharing the summary at their last visit."],
    ["Confirm extended health coverage", "Plan year rolled over — verify remaining annual maximum."],
    ["Book 6-week reassessment", "Due for outcome measures and a programme progression."],
  ];
  for (let i = 0; i < 14; i++) {
    const [title, detail] = taskTemplates[i % taskTemplates.length];
    const due = new Date(today);
    due.setDate(due.getDate() + between(-6, 12));
    ins(
      "INSERT INTO tasks (title,detail,due_on,assignee_id,patient_id,status,created_at) VALUES (?,?,?,?,?,?,?)",
      title, detail, toDateKey(due),
      pick(pracIds), pick(patientIds),
      chance(0.28) ? "done" : "open", TODAY,
    );
  }

  ins(
    "INSERT INTO audit_log (at, actor, action, entity, entity_id, detail) VALUES (?,?,?,?,NULL,?)",
    new Date().toISOString().slice(0, 19), "system", "seed", "clinic",
    "Demo clinic generated.",
  );

  db.exec("COMMIT");
}

/** Exposed for the CLI seeder so it can report what it built. */
export function seedSummary(db: DatabaseSync) {
  const count = (t: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  return {
    patients: count("patients"),
    practitioners: count("practitioners"),
    treatments: count("treatments"),
    appointments: count("appointments"),
    invoices: count("invoices"),
    payments: count("payments"),
    claims: count("claims"),
    notes: count("chart_notes"),
  };
}
