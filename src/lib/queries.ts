import "server-only";
import { all, one } from "./db";
import { addDays, todayKey } from "./format";
import type {
  Appointment,
  AppointmentView,
  ChartNoteView,
  ChartTemplate,
  Claim,
  ClaimView,
  Clinic,
  Communication,
  Discipline,
  InsurancePolicy,
  Invoice,
  InvoiceItem,
  InvoiceView,
  Location,
  Patient,
  Payment,
  Practitioner,
  PractitionerView,
  Product,
  TaskView,
  Treatment,
} from "./types";

/* ------------------------------------------------------------ clinic */

export function getClinic(): Clinic {
  return one<Clinic>("SELECT * FROM clinic WHERE id = 1")!;
}

export function listLocations(): Location[] {
  return all<Location>("SELECT * FROM locations ORDER BY id");
}

export function listDisciplines(): Discipline[] {
  return all<Discipline>("SELECT * FROM disciplines ORDER BY id");
}

/* ----------------------------------------------------- practitioners */

const PRACTITIONER_SELECT = `
  SELECT pr.*, d.name AS discipline
  FROM practitioners pr
  JOIN disciplines d ON d.id = pr.discipline_id
`;

export function listPractitioners(opts: { bookableOnly?: boolean } = {}): PractitionerView[] {
  const rows = all<PractitionerView>(
    `${PRACTITIONER_SELECT} WHERE pr.is_active = 1 ORDER BY pr.role = 'admin', pr.first_name`,
  );
  if (!opts.bookableOnly) return rows;
  return rows.filter((p) => p.online_booking === 1);
}

export function getPractitioner(id: number): PractitionerView | undefined {
  return one<PractitionerView>(`${PRACTITIONER_SELECT} WHERE pr.id = ?`, id);
}

export function listAvailability(practitionerId: number) {
  return all<{ id: number; weekday: number; start_min: number; end_min: number; location_id: number | null }>(
    "SELECT id, weekday, start_min, end_min, location_id FROM availability WHERE practitioner_id = ? ORDER BY weekday, start_min",
    practitionerId,
  );
}

/** Working-hours envelope for a set of practitioners on a weekday. */
export function dayWindow(weekday: number, practitionerIds?: number[]): { start: number; end: number } {
  const filter = practitionerIds?.length
    ? ` AND practitioner_id IN (${practitionerIds.map(() => "?").join(",")})`
    : "";
  const row = one<{ lo: number | null; hi: number | null }>(
    `SELECT MIN(start_min) AS lo, MAX(end_min) AS hi FROM availability WHERE weekday = ?${filter}`,
    weekday,
    ...(practitionerIds ?? []),
  );
  return { start: row?.lo ?? 8 * 60, end: row?.hi ?? 18 * 60 };
}

/* --------------------------------------------------------- treatments */

// Bookable services sort ahead of add-ons, so the first option in any picker is
// something a client could actually book on its own.
export function listTreatments(activeOnly = true): Treatment[] {
  return all<Treatment>(
    `SELECT * FROM treatments ${activeOnly ? "WHERE is_active = 1" : ""}
      ORDER BY discipline_id, online_bookable DESC, duration_min`,
  );
}

export function treatmentsFor(practitionerId: number): Treatment[] {
  return all<Treatment>(
    `SELECT t.* FROM treatments t
       JOIN practitioner_treatments pt ON pt.treatment_id = t.id
      WHERE pt.practitioner_id = ? AND t.is_active = 1
      ORDER BY t.online_bookable DESC, t.duration_min`,
    practitionerId,
  );
}

export function listProducts(): Product[] {
  return all<Product>("SELECT * FROM products WHERE is_active = 1 ORDER BY name");
}

export function listChartTemplates(): ChartTemplate[] {
  return all<ChartTemplate>("SELECT * FROM chart_templates ORDER BY kind, name");
}

export function getChartTemplate(id: number): ChartTemplate | undefined {
  return one<ChartTemplate>("SELECT * FROM chart_templates WHERE id = ?", id);
}

/* ----------------------------------------------------------- patients */

export interface PatientRow extends Patient {
  last_visit: string | null;
  next_visit: string | null;
  visit_count: number;
  balance_cents: number;
}

const PATIENT_ROW_SELECT = `
  SELECT p.*,
    (SELECT MAX(a.starts_at) FROM appointments a
      WHERE a.patient_id = p.id AND a.status IN ('completed','arrived')) AS last_visit,
    (SELECT MIN(a.starts_at) FROM appointments a
      WHERE a.patient_id = p.id AND a.status = 'booked' AND a.starts_at >= ?) AS next_visit,
    (SELECT COUNT(*) FROM appointments a
      WHERE a.patient_id = p.id AND a.status = 'completed') AS visit_count,
    (SELECT COALESCE(SUM(i.total_cents - i.paid_cents), 0) FROM invoices i
      WHERE i.patient_id = p.id AND i.status IN ('unpaid','partial')) AS balance_cents
  FROM patients p
`;

export function searchPatients(query: string, limit = 50, offset = 0): PatientRow[] {
  const now = todayKey();
  const q = query.trim();
  if (!q) {
    return all<PatientRow>(
      `${PATIENT_ROW_SELECT} WHERE p.is_active = 1 ORDER BY p.last_name, p.first_name LIMIT ? OFFSET ?`,
      now, limit, offset,
    );
  }
  const like = `%${q.toLowerCase()}%`;
  const digits = q.replace(/\D/g, "");
  // Only match on phone when the query actually contains digits — otherwise the
  // pattern collapses to '%%' and every client matches.
  const phoneClause = digits
    ? "OR REPLACE(REPLACE(REPLACE(p.phone,' ',''),'(',''),')','') LIKE ?"
    : "";
  return all<PatientRow>(
    `${PATIENT_ROW_SELECT}
      WHERE p.is_active = 1 AND (
        LOWER(p.first_name || ' ' || p.last_name) LIKE ?
        OR LOWER(p.last_name || ', ' || p.first_name) LIKE ?
        OR LOWER(p.email) LIKE ?
        ${phoneClause}
        OR LOWER(p.tags) LIKE ?
      )
      ORDER BY p.last_name, p.first_name LIMIT ? OFFSET ?`,
    now, like, like, like, ...(digits ? [`%${digits}%`] : []), like, limit, offset,
  );
}

export function countPatients(query = ""): number {
  const q = query.trim();
  if (!q) return one<{ n: number }>("SELECT COUNT(*) AS n FROM patients WHERE is_active = 1")!.n;
  const like = `%${q.toLowerCase()}%`;
  const digits = q.replace(/\D/g, "");
  const phoneClause = digits
    ? "OR REPLACE(REPLACE(REPLACE(p.phone,' ',''),'(',''),')','') LIKE ?"
    : "";
  return one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM patients p WHERE p.is_active = 1 AND (
       LOWER(p.first_name || ' ' || p.last_name) LIKE ?
       OR LOWER(p.email) LIKE ?
       ${phoneClause}
       OR LOWER(p.tags) LIKE ?)`,
    like, like, ...(digits ? [`%${digits}%`] : []), like,
  )!.n;
}

export function getPatient(id: number): PatientRow | undefined {
  return one<PatientRow>(`${PATIENT_ROW_SELECT} WHERE p.id = ?`, todayKey(), id);
}

export function patientPolicies(patientId: number): InsurancePolicy[] {
  return all<InsurancePolicy>(
    "SELECT * FROM insurance_policies WHERE patient_id = ? ORDER BY is_primary DESC, id",
    patientId,
  );
}

export function patientCommunications(patientId: number): Communication[] {
  return all<Communication>(
    "SELECT * FROM communications WHERE patient_id = ? ORDER BY created_at DESC, id DESC LIMIT 50",
    patientId,
  );
}

/* ------------------------------------------------------- appointments */

const APPOINTMENT_SELECT = `
  SELECT a.*,
    p.first_name || ' ' || p.last_name        AS patient_name,
    p.phone                                    AS patient_phone,
    pr.first_name || ' ' || pr.last_name       AS practitioner_name,
    pr.color                                   AS practitioner_color,
    t.name                                     AS treatment_name,
    t.duration_min                             AS duration_min,
    t.price_cents                              AS price_cents,
    l.name                                     AS location_name,
    d.name                                     AS discipline,
    EXISTS(SELECT 1 FROM chart_notes n WHERE n.appointment_id = a.id) AS has_note
  FROM appointments a
  JOIN patients p      ON p.id  = a.patient_id
  JOIN practitioners pr ON pr.id = a.practitioner_id
  JOIN treatments t    ON t.id  = a.treatment_id
  JOIN disciplines d   ON d.id  = pr.discipline_id
  LEFT JOIN locations l ON l.id = a.location_id
`;

export function appointmentsBetween(
  fromKey: string,
  toKeyExclusive: string,
  opts: { practitionerIds?: number[]; locationId?: number; includeCancelled?: boolean } = {},
): AppointmentView[] {
  const clauses = ["a.starts_at >= ?", "a.starts_at < ?"];
  const params: unknown[] = [`${fromKey}T00:00`, `${toKeyExclusive}T00:00`];

  if (opts.practitionerIds?.length) {
    clauses.push(`a.practitioner_id IN (${opts.practitionerIds.map(() => "?").join(",")})`);
    params.push(...opts.practitionerIds);
  }
  if (opts.locationId) {
    clauses.push("a.location_id = ?");
    params.push(opts.locationId);
  }
  if (!opts.includeCancelled) clauses.push("a.status != 'cancelled'");

  return all<AppointmentView>(
    `${APPOINTMENT_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY a.starts_at, pr.first_name`,
    ...params,
  );
}

export function appointmentsOn(dateKey: string, opts?: Parameters<typeof appointmentsBetween>[2]) {
  return appointmentsBetween(dateKey, addDays(dateKey, 1), opts);
}

export function getAppointment(id: number): AppointmentView | undefined {
  return one<AppointmentView>(`${APPOINTMENT_SELECT} WHERE a.id = ?`, id);
}

export function patientAppointments(patientId: number, limit = 200): AppointmentView[] {
  return all<AppointmentView>(
    `${APPOINTMENT_SELECT} WHERE a.patient_id = ? ORDER BY a.starts_at DESC LIMIT ?`,
    patientId, limit,
  );
}

export function upcomingFor(patientId: number): AppointmentView[] {
  return all<AppointmentView>(
    `${APPOINTMENT_SELECT} WHERE a.patient_id = ? AND a.status = 'booked' AND a.starts_at >= ?
     ORDER BY a.starts_at LIMIT 10`,
    patientId, `${todayKey()}T00:00`,
  );
}

/** Raw rows only — used by the booking engine to test for collisions. */
export function busyBlocks(practitionerId: number, dateKey: string) {
  return all<Pick<Appointment, "id" | "starts_at" | "ends_at">>(
    `SELECT id, starts_at, ends_at FROM appointments
      WHERE practitioner_id = ? AND starts_at >= ? AND starts_at < ? AND status != 'cancelled'
      ORDER BY starts_at`,
    practitionerId, `${dateKey}T00:00`, `${addDays(dateKey, 1)}T00:00`,
  );
}

/* -------------------------------------------------------- chart notes */

const NOTE_SELECT = `
  SELECT n.*, pr.first_name || ' ' || pr.last_name AS practitioner_name,
         pr.credentials, ct.name AS template_name
  FROM chart_notes n
  JOIN practitioners pr ON pr.id = n.practitioner_id
  LEFT JOIN chart_templates ct ON ct.id = n.template_id
`;

export function patientNotes(patientId: number, limit = 100): ChartNoteView[] {
  return all<ChartNoteView>(
    `${NOTE_SELECT} WHERE n.patient_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT ?`,
    patientId, limit,
  );
}

export function getNote(id: number): ChartNoteView | undefined {
  return one<ChartNoteView>(`${NOTE_SELECT} WHERE n.id = ?`, id);
}

export function noteForAppointment(appointmentId: number): ChartNoteView | undefined {
  return one<ChartNoteView>(`${NOTE_SELECT} WHERE n.appointment_id = ?`, appointmentId);
}

/* ------------------------------------------------------------ billing */

const INVOICE_SELECT = `
  SELECT i.*, p.first_name || ' ' || p.last_name AS patient_name,
         (i.total_cents - i.paid_cents) AS balance_cents
  FROM invoices i
  JOIN patients p ON p.id = i.patient_id
`;

export function listInvoices(opts: {
  status?: string;
  patientId?: number;
  query?: string;
  limit?: number;
} = {}): InvoiceView[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.status && opts.status !== "all") {
    if (opts.status === "outstanding") clauses.push("i.status IN ('unpaid','partial')");
    else {
      clauses.push("i.status = ?");
      params.push(opts.status);
    }
  }
  if (opts.patientId) {
    clauses.push("i.patient_id = ?");
    params.push(opts.patientId);
  }
  if (opts.query?.trim()) {
    clauses.push("(LOWER(i.number) LIKE ? OR LOWER(p.first_name || ' ' || p.last_name) LIKE ?)");
    const like = `%${opts.query.trim().toLowerCase()}%`;
    params.push(like, like);
  }
  return all<InvoiceView>(
    `${INVOICE_SELECT} ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     ORDER BY i.issued_on DESC, i.id DESC LIMIT ?`,
    ...params, opts.limit ?? 100,
  );
}

export function getInvoice(id: number): InvoiceView | undefined {
  return one<InvoiceView>(`${INVOICE_SELECT} WHERE i.id = ?`, id);
}

export function invoiceItems(invoiceId: number): InvoiceItem[] {
  return all<InvoiceItem>("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id", invoiceId);
}

export function invoicePayments(invoiceId: number): Payment[] {
  return all<Payment>(
    "SELECT * FROM payments WHERE invoice_id = ? ORDER BY received_on, id",
    invoiceId,
  );
}

export function invoiceClaims(invoiceId: number): Claim[] {
  return all<Claim>("SELECT * FROM claims WHERE invoice_id = ? ORDER BY id", invoiceId);
}

export function listClaims(status?: string, limit = 100): ClaimView[] {
  const where = status && status !== "all" ? "WHERE c.status = ?" : "";
  const params = status && status !== "all" ? [status] : [];
  return all<ClaimView>(
    `SELECT c.*, p.first_name || ' ' || p.last_name AS patient_name, i.number AS invoice_number
       FROM claims c
       JOIN patients p ON p.id = c.patient_id
       JOIN invoices i ON i.id = c.invoice_id
       ${where}
      ORDER BY c.submitted_on DESC, c.id DESC LIMIT ?`,
    ...params, limit,
  );
}

export function listPayments(limit = 100) {
  return all<Payment & { patient_name: string; invoice_number: string }>(
    `SELECT pay.*, p.first_name || ' ' || p.last_name AS patient_name, i.number AS invoice_number
       FROM payments pay
       JOIN patients p ON p.id = pay.patient_id
       JOIN invoices i ON i.id = pay.invoice_id
      ORDER BY pay.received_on DESC, pay.id DESC LIMIT ?`,
    limit,
  );
}

export function patientInvoices(patientId: number): InvoiceView[] {
  return listInvoices({ patientId, limit: 200 });
}

/* -------------------------------------------------------------- tasks */

export function listTasks(status = "open"): TaskView[] {
  return all<TaskView>(
    `SELECT t.*,
       pr.first_name || ' ' || pr.last_name AS assignee_name,
       p.first_name  || ' ' || p.last_name  AS patient_name
     FROM tasks t
     LEFT JOIN practitioners pr ON pr.id = t.assignee_id
     LEFT JOIN patients p       ON p.id  = t.patient_id
     ${status === "all" ? "" : "WHERE t.status = ?"}
     ORDER BY t.status = 'done', t.due_on`,
    ...(status === "all" ? [] : [status]),
  );
}

/* ---------------------------------------------------------- dashboard */

export interface DashboardStats {
  today: {
    total: number;
    completed: number;
    arrived: number;
    booked: number;
    cancelled: number;
    noShow: number;
    bookedValueCents: number;
  };
  mtd: {
    revenueCents: number;
    prevRevenueCents: number;
    visits: number;
    prevVisits: number;
    newPatients: number;
    prevNewPatients: number;
  };
  outstandingCents: number;
  outstandingCount: number;
  claimsPendingCents: number;
  claimsPendingCount: number;
  unsignedNotes: number;
  openTasks: number;
  utilisationPct: number;
}

export function dashboardStats(dateKey = todayKey()): DashboardStats {
  const monthStart = `${dateKey.slice(0, 7)}-01`;
  const prevMonthStart = (() => {
    const [y, m] = dateKey.split("-").map(Number);
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    return `${py}-${String(pm).padStart(2, "0")}-01`;
  })();
  const dayOfMonth = Number(dateKey.slice(8, 10));
  const prevMonthSameDay = `${prevMonthStart.slice(0, 8)}${String(dayOfMonth).padStart(2, "0")}`;

  const day = one<{
    total: number; completed: number; arrived: number; booked: number; cancelled: number; no_show: number;
  }>(
    `SELECT COUNT(*) AS total,
       SUM(status='completed') AS completed,
       SUM(status='arrived')   AS arrived,
       SUM(status='booked')    AS booked,
       SUM(status='cancelled') AS cancelled,
       SUM(status='no_show')   AS no_show
     FROM appointments WHERE starts_at >= ? AND starts_at < ?`,
    `${dateKey}T00:00`, `${addDays(dateKey, 1)}T00:00`,
  )!;

  const dayValue = one<{ v: number }>(
    `SELECT COALESCE(SUM(t.price_cents),0) AS v
       FROM appointments a JOIN treatments t ON t.id = a.treatment_id
      WHERE a.starts_at >= ? AND a.starts_at < ? AND a.status IN ('booked','arrived','completed')`,
    `${dateKey}T00:00`, `${addDays(dateKey, 1)}T00:00`,
  )!.v;

  const revenue = (from: string, to: string) =>
    one<{ v: number }>(
      "SELECT COALESCE(SUM(amount_cents),0) AS v FROM payments WHERE received_on >= ? AND received_on <= ?",
      from, to,
    )!.v;

  const visits = (from: string, to: string) =>
    one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM appointments
        WHERE status = 'completed' AND starts_at >= ? AND starts_at <= ?`,
      `${from}T00:00`, `${to}T23:59`,
    )!.n;

  const newPatients = (from: string, to: string) =>
    one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM patients WHERE created_at >= ? AND created_at <= ?",
      from, to,
    )!.n;

  const outstanding = one<{ v: number; n: number }>(
    `SELECT COALESCE(SUM(total_cents - paid_cents),0) AS v, COUNT(*) AS n
       FROM invoices WHERE status IN ('unpaid','partial')`,
  )!;

  const claimsPending = one<{ v: number; n: number }>(
    `SELECT COALESCE(SUM(billed_cents - paid_cents),0) AS v, COUNT(*) AS n
       FROM claims WHERE status IN ('submitted','accepted')`,
  )!;

  const unsigned = one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM chart_notes WHERE status = 'draft'",
  )!.n;

  const openTasks = one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM tasks WHERE status = 'open'",
  )!.n;

  // Utilisation: booked minutes today against available working minutes today.
  const weekday = new Date(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(5, 7)) - 1,
    Number(dateKey.slice(8, 10)),
  ).getDay();
  const capacity = one<{ v: number }>(
    "SELECT COALESCE(SUM(end_min - start_min),0) AS v FROM availability WHERE weekday = ?",
    weekday,
  )!.v;
  const bookedMin = one<{ v: number }>(
    `SELECT COALESCE(SUM(t.duration_min),0) AS v
       FROM appointments a JOIN treatments t ON t.id = a.treatment_id
      WHERE a.starts_at >= ? AND a.starts_at < ? AND a.status IN ('booked','arrived','completed')`,
    `${dateKey}T00:00`, `${addDays(dateKey, 1)}T00:00`,
  )!.v;

  return {
    today: {
      total: day.total,
      completed: day.completed ?? 0,
      arrived: day.arrived ?? 0,
      booked: day.booked ?? 0,
      cancelled: day.cancelled ?? 0,
      noShow: day.no_show ?? 0,
      bookedValueCents: dayValue,
    },
    mtd: {
      revenueCents: revenue(monthStart, dateKey),
      prevRevenueCents: revenue(prevMonthStart, prevMonthSameDay),
      visits: visits(monthStart, dateKey),
      prevVisits: visits(prevMonthStart, prevMonthSameDay),
      newPatients: newPatients(monthStart, dateKey),
      prevNewPatients: newPatients(prevMonthStart, prevMonthSameDay),
    },
    outstandingCents: outstanding.v,
    outstandingCount: outstanding.n,
    claimsPendingCents: claimsPending.v,
    claimsPendingCount: claimsPending.n,
    unsignedNotes: unsigned,
    openTasks,
    utilisationPct: capacity ? Math.round((bookedMin / capacity) * 100) : 0,
  };
}

/* ------------------------------------------------------------ reports */

export function revenueByDay(fromKey: string, toKey: string) {
  return all<{ day: string; cents: number }>(
    `SELECT received_on AS day, SUM(amount_cents) AS cents
       FROM payments WHERE received_on >= ? AND received_on <= ?
      GROUP BY received_on ORDER BY received_on`,
    fromKey, toKey,
  );
}

export function revenueByPractitioner(fromKey: string, toKey: string) {
  return all<{ name: string; color: string; discipline: string; cents: number; visits: number }>(
    `SELECT pr.first_name || ' ' || pr.last_name AS name, pr.color, d.name AS discipline,
            COALESCE(SUM(i.total_cents),0) AS cents, COUNT(DISTINCT a.id) AS visits
       FROM appointments a
       JOIN practitioners pr ON pr.id = a.practitioner_id
       JOIN disciplines d    ON d.id  = pr.discipline_id
       LEFT JOIN invoices i  ON i.id  = a.invoice_id
      WHERE a.status = 'completed' AND a.starts_at >= ? AND a.starts_at <= ?
      GROUP BY pr.id ORDER BY cents DESC`,
    `${fromKey}T00:00`, `${toKey}T23:59`,
  );
}

export function revenueByDiscipline(fromKey: string, toKey: string) {
  return all<{ discipline: string; color: string; cents: number; visits: number }>(
    `SELECT d.name AS discipline, d.color, COALESCE(SUM(i.total_cents),0) AS cents,
            COUNT(DISTINCT a.id) AS visits
       FROM appointments a
       JOIN practitioners pr ON pr.id = a.practitioner_id
       JOIN disciplines d    ON d.id  = pr.discipline_id
       LEFT JOIN invoices i  ON i.id  = a.invoice_id
      WHERE a.status = 'completed' AND a.starts_at >= ? AND a.starts_at <= ?
      GROUP BY d.id HAVING cents > 0 ORDER BY cents DESC`,
    `${fromKey}T00:00`, `${toKey}T23:59`,
  );
}

export function topTreatments(fromKey: string, toKey: string, limit = 8) {
  return all<{ name: string; visits: number; cents: number }>(
    `SELECT t.name, COUNT(*) AS visits, COALESCE(SUM(t.price_cents),0) AS cents
       FROM appointments a JOIN treatments t ON t.id = a.treatment_id
      WHERE a.status = 'completed' AND a.starts_at >= ? AND a.starts_at <= ?
      GROUP BY t.id ORDER BY visits DESC LIMIT ?`,
    `${fromKey}T00:00`, `${toKey}T23:59`, limit,
  );
}

export function attendanceBreakdown(fromKey: string, toKey: string) {
  return all<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM appointments
      WHERE starts_at >= ? AND starts_at <= ? GROUP BY status`,
    `${fromKey}T00:00`, `${toKey}T23:59`,
  );
}

export function bookingSourceSplit(fromKey: string, toKey: string) {
  return all<{ source: string; n: number }>(
    `SELECT source, COUNT(*) AS n FROM appointments
      WHERE starts_at >= ? AND starts_at <= ? GROUP BY source`,
    `${fromKey}T00:00`, `${toKey}T23:59`,
  );
}

export function newVsReturning(fromKey: string, toKey: string) {
  const row = one<{ first: number; total: number }>(
    `SELECT SUM(is_first_visit) AS first, COUNT(*) AS total FROM appointments
      WHERE status = 'completed' AND starts_at >= ? AND starts_at <= ?`,
    `${fromKey}T00:00`, `${toKey}T23:59`,
  )!;
  return { first: row.first ?? 0, returning: (row.total ?? 0) - (row.first ?? 0) };
}

export function insurerPerformance(fromKey: string, toKey: string) {
  return all<{ insurer_name: string; claims: number; billed: number; paid: number; outstanding: number }>(
    `SELECT insurer_name, COUNT(*) AS claims,
            COALESCE(SUM(billed_cents),0) AS billed,
            COALESCE(SUM(paid_cents),0)   AS paid,
            COALESCE(SUM(billed_cents - paid_cents),0) AS outstanding
       FROM claims WHERE submitted_on >= ? AND submitted_on <= ?
      GROUP BY insurer_name ORDER BY billed DESC`,
    fromKey, toKey,
  );
}

export function referralSources() {
  return all<{ referral_source: string; n: number }>(
    `SELECT COALESCE(NULLIF(referral_source,''),'Not recorded') AS referral_source, COUNT(*) AS n
       FROM patients GROUP BY referral_source ORDER BY n DESC`,
  );
}

export function retentionCohort() {
  return all<{ bucket: string; n: number }>(
    `SELECT CASE
              WHEN visits = 1 THEN '1 visit'
              WHEN visits BETWEEN 2 AND 3 THEN '2–3 visits'
              WHEN visits BETWEEN 4 AND 7 THEN '4–7 visits'
              WHEN visits BETWEEN 8 AND 15 THEN '8–15 visits'
              ELSE '16+ visits' END AS bucket,
            COUNT(*) AS n
       FROM (SELECT patient_id, COUNT(*) AS visits FROM appointments
              WHERE status = 'completed' GROUP BY patient_id)
      GROUP BY bucket`,
  );
}

export function agedReceivables() {
  return all<{ bucket: string; cents: number; n: number }>(
    `SELECT CASE
              WHEN julianday('now') - julianday(issued_on) <= 30 THEN '0–30 days'
              WHEN julianday('now') - julianday(issued_on) <= 60 THEN '31–60 days'
              WHEN julianday('now') - julianday(issued_on) <= 90 THEN '61–90 days'
              ELSE '90+ days' END AS bucket,
            SUM(total_cents - paid_cents) AS cents, COUNT(*) AS n
       FROM invoices WHERE status IN ('unpaid','partial')
      GROUP BY bucket`,
  );
}
