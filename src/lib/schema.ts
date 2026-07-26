/**
 * ClinicMaxx schema.
 *
 * Kept as a TypeScript module rather than a .sql file the app reads at runtime:
 * bundling it means no filesystem lookup in production and no dependency on the
 * process working directory.
 */

export const SCHEMA = `-- ClinicMaxx schema
-- Money is always stored in integer cents. Tax rates are basis points (1250 = 12.5%).
-- Appointment timestamps are stored as local wall-clock ISO strings ("2026-07-25T14:30")
-- so they sort lexicographically and never drift when the clinic's timezone is applied.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clinic (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  name                TEXT NOT NULL,
  tagline             TEXT NOT NULL DEFAULT '',
  email               TEXT NOT NULL DEFAULT '',
  phone               TEXT NOT NULL DEFAULT '',
  website             TEXT NOT NULL DEFAULT '',
  timezone            TEXT NOT NULL DEFAULT 'America/Vancouver',
  currency            TEXT NOT NULL DEFAULT 'CAD',
  booking_lead_hours  INTEGER NOT NULL DEFAULT 2,
  cancellation_hours  INTEGER NOT NULL DEFAULT 24,
  cancellation_fee_cents INTEGER NOT NULL DEFAULT 4000,
  default_tax_bps     INTEGER NOT NULL DEFAULT 0,
  invoice_prefix      TEXT NOT NULL DEFAULT 'CMX',
  next_invoice_seq    INTEGER NOT NULL DEFAULT 1001
);

CREATE TABLE IF NOT EXISTS locations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  address     TEXT NOT NULL DEFAULT '',
  city        TEXT NOT NULL DEFAULT '',
  region      TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS disciplines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT NOT NULL DEFAULT 'teal',
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS practitioners (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  credentials           TEXT NOT NULL DEFAULT '',
  discipline_id         INTEGER NOT NULL REFERENCES disciplines(id),
  email                 TEXT NOT NULL DEFAULT '',
  phone                 TEXT NOT NULL DEFAULT '',
  bio                   TEXT NOT NULL DEFAULT '',
  color                 TEXT NOT NULL DEFAULT 'teal',
  role                  TEXT NOT NULL DEFAULT 'practitioner', -- practitioner | admin | owner
  location_id           INTEGER REFERENCES locations(id),
  online_booking        INTEGER NOT NULL DEFAULT 1,
  is_active             INTEGER NOT NULL DEFAULT 1,
  started_on            TEXT NOT NULL DEFAULT ''
);

-- Recurring weekly working hours. weekday: 0 = Sunday .. 6 = Saturday.
CREATE TABLE IF NOT EXISTS availability (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  practitioner_id INTEGER NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  location_id     INTEGER REFERENCES locations(id),
  weekday         INTEGER NOT NULL,
  start_min       INTEGER NOT NULL,  -- minutes from midnight
  end_min         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS treatments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  discipline_id  INTEGER NOT NULL REFERENCES disciplines(id),
  duration_min   INTEGER NOT NULL,
  price_cents    INTEGER NOT NULL,
  tax_bps        INTEGER NOT NULL DEFAULT 0,
  description    TEXT NOT NULL DEFAULT '',
  online_bookable INTEGER NOT NULL DEFAULT 1,
  is_active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS practitioner_treatments (
  practitioner_id INTEGER NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  treatment_id    INTEGER NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  PRIMARY KEY (practitioner_id, treatment_id)
);

CREATE TABLE IF NOT EXISTS patients (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  preferred_name      TEXT NOT NULL DEFAULT '',
  email               TEXT NOT NULL DEFAULT '',
  phone               TEXT NOT NULL DEFAULT '',
  date_of_birth       TEXT NOT NULL DEFAULT '',
  pronouns            TEXT NOT NULL DEFAULT '',
  address             TEXT NOT NULL DEFAULT '',
  city                TEXT NOT NULL DEFAULT '',
  region              TEXT NOT NULL DEFAULT '',
  postal_code         TEXT NOT NULL DEFAULT '',
  emergency_name      TEXT NOT NULL DEFAULT '',
  emergency_phone     TEXT NOT NULL DEFAULT '',
  occupation          TEXT NOT NULL DEFAULT '',
  referral_source     TEXT NOT NULL DEFAULT '',
  family_doctor       TEXT NOT NULL DEFAULT '',
  alert               TEXT NOT NULL DEFAULT '',      -- shows as a banner on the chart
  tags                TEXT NOT NULL DEFAULT '',      -- comma separated
  notes               TEXT NOT NULL DEFAULT '',
  intake_completed    INTEGER NOT NULL DEFAULT 0,
  consent_signed      INTEGER NOT NULL DEFAULT 0,
  is_active           INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id        INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  insurer_name      TEXT NOT NULL,
  plan_type         TEXT NOT NULL DEFAULT 'extended', -- extended | mva | wcb | ihap
  policy_number     TEXT NOT NULL DEFAULT '',
  member_id         TEXT NOT NULL DEFAULT '',
  coverage_percent  INTEGER NOT NULL DEFAULT 80,
  annual_max_cents  INTEGER NOT NULL DEFAULT 50000,
  used_cents        INTEGER NOT NULL DEFAULT 0,
  visits_allowed    INTEGER NOT NULL DEFAULT 0,      -- 0 = unlimited
  visits_used       INTEGER NOT NULL DEFAULT 0,
  direct_billing    INTEGER NOT NULL DEFAULT 1,
  is_primary        INTEGER NOT NULL DEFAULT 1,
  valid_to          TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS appointments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id        INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  practitioner_id   INTEGER NOT NULL REFERENCES practitioners(id),
  treatment_id      INTEGER NOT NULL REFERENCES treatments(id),
  location_id       INTEGER REFERENCES locations(id),
  starts_at         TEXT NOT NULL,   -- 'YYYY-MM-DDTHH:MM'
  ends_at           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'booked', -- booked|arrived|completed|cancelled|no_show
  source            TEXT NOT NULL DEFAULT 'staff',  -- staff|online
  is_first_visit    INTEGER NOT NULL DEFAULT 0,
  notes             TEXT NOT NULL DEFAULT '',
  cancel_reason     TEXT NOT NULL DEFAULT '',
  reminder_sent     INTEGER NOT NULL DEFAULT 0,
  invoice_id        INTEGER REFERENCES invoices(id),
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appt_start ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_appt_prac  ON appointments(practitioner_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appt_pat   ON appointments(patient_id, starts_at);

CREATE TABLE IF NOT EXISTS chart_templates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  discipline_id INTEGER REFERENCES disciplines(id),
  kind          TEXT NOT NULL DEFAULT 'soap',  -- soap | intake | assessment | discharge
  fields_json   TEXT NOT NULL                  -- [{key,label,type,placeholder}]
);

CREATE TABLE IF NOT EXISTS chart_notes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  practitioner_id INTEGER NOT NULL REFERENCES practitioners(id),
  appointment_id  INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  template_id     INTEGER REFERENCES chart_templates(id),
  title           TEXT NOT NULL,
  body_json       TEXT NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'draft', -- draft | signed
  signed_at       TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_note_patient ON chart_notes(patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  sku         TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL,
  cost_cents  INTEGER NOT NULL DEFAULT 0,
  stock       INTEGER NOT NULL DEFAULT 0,
  tax_bps     INTEGER NOT NULL DEFAULT 1200,
  is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  number         TEXT NOT NULL UNIQUE,
  patient_id     INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  issued_on      TEXT NOT NULL,
  due_on         TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | partial | paid | void
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents      INTEGER NOT NULL DEFAULT 0,
  total_cents    INTEGER NOT NULL DEFAULT 0,
  paid_cents     INTEGER NOT NULL DEFAULT 0,
  notes          TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_inv_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_inv_issued  ON invoices(issued_on);

CREATE TABLE IF NOT EXISTS invoice_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL DEFAULT 'treatment', -- treatment | product | fee | adjustment
  description  TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  unit_cents   INTEGER NOT NULL,
  tax_bps      INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL,
  treatment_id INTEGER REFERENCES treatments(id),
  product_id   INTEGER REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  patient_id   INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  method       TEXT NOT NULL DEFAULT 'card', -- card | cash | etransfer | insurer | credit
  reference    TEXT NOT NULL DEFAULT '',
  received_on  TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS claims (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id      INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  policy_id       INTEGER REFERENCES insurance_policies(id) ON DELETE SET NULL,
  insurer_name    TEXT NOT NULL,
  submitted_on    TEXT NOT NULL DEFAULT '',
  responded_on    TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft', -- draft|submitted|accepted|paid|rejected
  billed_cents    INTEGER NOT NULL DEFAULT 0,
  approved_cents  INTEGER NOT NULL DEFAULT 0,
  paid_cents      INTEGER NOT NULL DEFAULT 0,
  adjudication    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS communications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'note',   -- email | sms | call | note
  direction  TEXT NOT NULL DEFAULT 'out',    -- in | out
  subject    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  author     TEXT NOT NULL DEFAULT 'Front desk',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  due_on      TEXT NOT NULL DEFAULT '',
  assignee_id INTEGER REFERENCES practitioners(id) ON DELETE SET NULL,
  patient_id  INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'open',  -- open | done
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        TEXT NOT NULL,
  actor     TEXT NOT NULL DEFAULT 'system',
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id INTEGER,
  detail    TEXT NOT NULL DEFAULT ''
);
`;
