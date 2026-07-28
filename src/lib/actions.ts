"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { all, audit, one, run, tx } from "./db";
import { addMinutes, todayKey, toStamp } from "./format";
import type { ActionResult, Appointment, Treatment } from "./types";

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function num(fd: FormData, key: string): number {
  const v = Number(str(fd, key));
  return Number.isFinite(v) ? v : 0;
}
function bool(fd: FormData, key: string): number {
  const v = fd.get(key);
  return v === "on" || v === "1" || v === "true" ? 1 : 0;
}
/** Accepts "120", "120.50", "$120.50" and returns cents. */
function cents(fd: FormData, key: string): number {
  const raw = str(fd, key).replace(/[^0-9.\-]/g, "");
  if (!raw) return 0;
  return Math.round(parseFloat(raw) * 100);
}

function refreshEverywhere(patientId?: number) {
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  revalidatePath("/billing");
  revalidatePath("/reports");
  revalidatePath("/patients");
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

/* ------------------------------------------------------------------ *
 * Scheduling
 * ------------------------------------------------------------------ */

const bookingSchema = z.object({
  patientId: z.number().int().positive("Choose a client."),
  practitionerId: z.number().int().positive("Choose a practitioner."),
  treatmentId: z.number().int().positive("Choose a treatment."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a valid time."),
});

export async function bookAppointment(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const parsed = bookingSchema.safeParse({
    patientId: num(fd, "patientId"),
    practitionerId: num(fd, "practitionerId"),
    treatmentId: num(fd, "treatmentId"),
    date: str(fd, "date"),
    time: str(fd, "time"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { patientId, practitionerId, treatmentId, date, time } = parsed.data;
  const treatment = one<Treatment>("SELECT * FROM treatments WHERE id = ?", treatmentId);
  if (!treatment) return { ok: false, error: "That treatment no longer exists." };

  const startsAt = `${date}T${time}`;
  const endsAt = addMinutes(startsAt, treatment.duration_min);

  const clash = all<Appointment>(
    `SELECT * FROM appointments
      WHERE practitioner_id = ? AND status != 'cancelled'
        AND starts_at < ? AND ends_at > ?`,
    practitionerId, endsAt, startsAt,
  );
  if (clash.length) {
    return { ok: false, error: "That practitioner already has an appointment in this slot." };
  }

  const prac = one<{ location_id: number | null }>(
    "SELECT location_id FROM practitioners WHERE id = ?",
    practitionerId,
  );
  const priorVisits = one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM appointments WHERE patient_id = ?",
    patientId,
  )!.n;

  const id = run(
    `INSERT INTO appointments (patient_id,practitioner_id,treatment_id,location_id,starts_at,ends_at,
       status,source,is_first_visit,notes,created_at)
     VALUES (?,?,?,?,?,?,'booked',?,?,?,?)`,
    patientId, practitionerId, treatmentId, prac?.location_id ?? null,
    startsAt, endsAt,
    str(fd, "source") || "staff",
    priorVisits === 0 ? 1 : 0,
    str(fd, "notes"),
    todayKey(),
  );

  audit("book", "appointment", id, `${startsAt} · treatment ${treatmentId}`);
  refreshEverywhere(patientId);
  return { ok: true, id, message: "Appointment booked." };
}

export async function rescheduleAppointment(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "appointmentId");
  const date = str(fd, "date");
  const time = str(fd, "time");
  const treatmentId = num(fd, "treatmentId");
  const practitionerId = num(fd, "practitionerId");

  const appt = one<Appointment>("SELECT * FROM appointments WHERE id = ?", id);
  if (!appt) return { ok: false, error: "Appointment not found." };

  const treatment = one<Treatment>(
    "SELECT * FROM treatments WHERE id = ?",
    treatmentId || appt.treatment_id,
  )!;
  const startsAt = `${date}T${time}`;
  const endsAt = addMinutes(startsAt, treatment.duration_min);
  const pracId = practitionerId || appt.practitioner_id;

  const clash = all<Appointment>(
    `SELECT * FROM appointments
      WHERE practitioner_id = ? AND id != ? AND status != 'cancelled'
        AND starts_at < ? AND ends_at > ?`,
    pracId, id, endsAt, startsAt,
  );
  if (clash.length) return { ok: false, error: "That slot is already taken." };

  run(
    "UPDATE appointments SET starts_at = ?, ends_at = ?, treatment_id = ?, practitioner_id = ?, notes = ? WHERE id = ?",
    startsAt, endsAt, treatment.id, pracId, str(fd, "notes"), id,
  );
  audit("reschedule", "appointment", id, `→ ${startsAt}`);
  refreshEverywhere(appt.patient_id);
  return { ok: true, id, message: "Appointment updated." };
}

export async function setAppointmentStatus(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "appointmentId");
  const status = str(fd, "status");
  const valid = ["booked", "arrived", "completed", "cancelled", "no_show"];
  if (!valid.includes(status)) return { ok: false, error: "Unknown status." };

  const appt = one<Appointment>("SELECT * FROM appointments WHERE id = ?", id);
  if (!appt) return { ok: false, error: "Appointment not found." };

  run(
    "UPDATE appointments SET status = ?, cancel_reason = ? WHERE id = ?",
    status,
    status === "cancelled" ? str(fd, "reason") : "",
    id,
  );
  audit("status", "appointment", id, status);

  // Checking someone out creates the invoice if one isn't there yet.
  if (status === "completed" && !appt.invoice_id) {
    createInvoiceForAppointment(id);
  }
  refreshEverywhere(appt.patient_id);
  return { ok: true, id, message: `Marked ${status.replace("_", " ")}.` };
}

export async function deleteAppointment(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "appointmentId");
  const appt = one<Appointment>("SELECT * FROM appointments WHERE id = ?", id);
  if (!appt) return { ok: false, error: "Appointment not found." };
  if (appt.invoice_id) {
    return { ok: false, error: "This visit has been invoiced — cancel it instead of deleting." };
  }
  run("DELETE FROM appointments WHERE id = ?", id);
  audit("delete", "appointment", id);
  refreshEverywhere(appt.patient_id);
  return { ok: true, message: "Appointment removed." };
}

/* ------------------------------------------------------------------ *
 * Patients
 * ------------------------------------------------------------------ */

const patientSchema = z.object({
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
  email: z.union([z.literal(""), z.string().email("That email doesn't look right.")]),
});

function patientFields(fd: FormData) {
  return {
    first_name: str(fd, "first_name"),
    last_name: str(fd, "last_name"),
    preferred_name: str(fd, "preferred_name"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    date_of_birth: str(fd, "date_of_birth"),
    pronouns: str(fd, "pronouns"),
    address: str(fd, "address"),
    city: str(fd, "city"),
    region: str(fd, "region"),
    postal_code: str(fd, "postal_code"),
    emergency_name: str(fd, "emergency_name"),
    emergency_phone: str(fd, "emergency_phone"),
    occupation: str(fd, "occupation"),
    referral_source: str(fd, "referral_source"),
    family_doctor: str(fd, "family_doctor"),
    alert: str(fd, "alert"),
    tags: str(fd, "tags"),
    notes: str(fd, "notes"),
  };
}

export async function createPatient(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const f = patientFields(fd);
  const parsed = patientSchema.safeParse(f);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const keys = Object.keys(f);
  const id = run(
    `INSERT INTO patients (${keys.join(",")},intake_completed,consent_signed,created_at)
     VALUES (${keys.map(() => "?").join(",")},?,?,?)`,
    ...Object.values(f), bool(fd, "intake_completed"), bool(fd, "consent_signed"), todayKey(),
  );
  audit("create", "patient", id, `${f.first_name} ${f.last_name}`);
  revalidatePath("/patients");
  return { ok: true, id, message: "Client created." };
}

export async function updatePatient(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "patientId");
  const f = patientFields(fd);
  const parsed = patientSchema.safeParse(f);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sets = Object.keys(f).map((k) => `${k} = ?`).join(",");
  run(
    `UPDATE patients SET ${sets}, intake_completed = ?, consent_signed = ? WHERE id = ?`,
    ...Object.values(f), bool(fd, "intake_completed"), bool(fd, "consent_signed"), id,
  );
  audit("update", "patient", id);
  refreshEverywhere(id);
  return { ok: true, id, message: "Client details saved." };
}

export async function archivePatient(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "patientId");
  run("UPDATE patients SET is_active = 0 WHERE id = ?", id);
  audit("archive", "patient", id);
  revalidatePath("/patients");
  redirect("/patients");
}

/* ------------------------------------------------------------------ *
 * Insurance
 * ------------------------------------------------------------------ */

export async function savePolicy(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "policyId");
  const patientId = num(fd, "patientId");
  const insurer = str(fd, "insurer_name");
  if (!insurer) return { ok: false, error: "Insurer name is required." };

  const values = [
    insurer,
    str(fd, "plan_type") || "extended",
    str(fd, "policy_number"),
    str(fd, "member_id"),
    num(fd, "coverage_percent"),
    cents(fd, "annual_max"),
    cents(fd, "used"),
    num(fd, "visits_allowed"),
    num(fd, "visits_used"),
    bool(fd, "direct_billing"),
    bool(fd, "is_primary"),
    str(fd, "valid_to"),
  ];

  if (id) {
    run(
      `UPDATE insurance_policies SET insurer_name=?,plan_type=?,policy_number=?,member_id=?,
         coverage_percent=?,annual_max_cents=?,used_cents=?,visits_allowed=?,visits_used=?,
         direct_billing=?,is_primary=? ,valid_to=? WHERE id = ?`,
      ...values, id,
    );
  } else {
    run(
      `INSERT INTO insurance_policies (patient_id,insurer_name,plan_type,policy_number,member_id,
         coverage_percent,annual_max_cents,used_cents,visits_allowed,visits_used,direct_billing,is_primary,valid_to)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      patientId, ...values,
    );
  }
  audit("save", "policy", id || undefined, insurer);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true, message: "Insurance policy saved." };
}

export async function deletePolicy(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "policyId");
  const patientId = num(fd, "patientId");
  run("DELETE FROM insurance_policies WHERE id = ?", id);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true, message: "Policy removed." };
}

/* ------------------------------------------------------------------ *
 * Charting
 * ------------------------------------------------------------------ */

export async function saveChartNote(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "noteId");
  const patientId = num(fd, "patientId");
  const practitionerId = num(fd, "practitionerId");
  const templateId = num(fd, "templateId");
  const appointmentId = num(fd, "appointmentId");
  const sign = str(fd, "intent") === "sign";

  if (!patientId) return { ok: false, error: "Missing client." };
  if (!practitionerId) return { ok: false, error: "Choose the practitioner signing this note." };

  // Every field arrives as `field:<key>` so templates stay data-driven.
  const body: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("field:") && typeof v === "string") body[k.slice(6)] = v;
  }

  const now = toStamp(new Date());
  const title = str(fd, "title") || `Chart note — ${todayKey()}`;

  if (id) {
    const existing = one<{ status: string }>("SELECT status FROM chart_notes WHERE id = ?", id);
    if (existing?.status === "signed") {
      return { ok: false, error: "Signed notes are locked. Add an addendum instead." };
    }
    run(
      `UPDATE chart_notes SET title=?, body_json=?, practitioner_id=?, status=?, signed_at=?, updated_at=?
       WHERE id = ?`,
      title, JSON.stringify(body), practitionerId,
      sign ? "signed" : "draft", sign ? now : "", now, id,
    );
    audit(sign ? "sign" : "update", "chart_note", id);
    revalidatePath(`/patients/${patientId}`);
    return { ok: true, id, message: sign ? "Note signed and locked." : "Draft saved." };
  }

  const newId = run(
    `INSERT INTO chart_notes (patient_id,practitioner_id,appointment_id,template_id,title,body_json,
       status,signed_at,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    patientId, practitionerId, appointmentId || null, templateId || null,
    title, JSON.stringify(body),
    sign ? "signed" : "draft", sign ? now : "", now, now,
  );
  audit(sign ? "sign" : "create", "chart_note", newId);
  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/dashboard");
  return { ok: true, id: newId, message: sign ? "Note signed and locked." : "Draft saved." };
}

export async function addAddendum(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const noteId = num(fd, "noteId");
  const text = str(fd, "addendum");
  if (!text) return { ok: false, error: "Write something first." };

  const note = one<{ body_json: string; patient_id: number; status: string }>(
    "SELECT body_json, patient_id, status FROM chart_notes WHERE id = ?",
    noteId,
  );
  if (!note) return { ok: false, error: "Note not found." };

  const body = JSON.parse(note.body_json) as Record<string, string>;
  const stamp = toStamp(new Date()).replace("T", " ");
  body.addendum = `${body.addendum ? `${body.addendum}\n\n` : ""}[${stamp}] ${text}`;

  run("UPDATE chart_notes SET body_json = ?, updated_at = ? WHERE id = ?",
    JSON.stringify(body), toStamp(new Date()), noteId);
  audit("addendum", "chart_note", noteId);
  revalidatePath(`/patients/${note.patient_id}`);
  return { ok: true, message: "Addendum added." };
}

/* ------------------------------------------------------------------ *
 * Billing
 * ------------------------------------------------------------------ */

function nextInvoiceNumber(): string {
  const c = one<{ invoice_prefix: string; next_invoice_seq: number }>(
    "SELECT invoice_prefix, next_invoice_seq FROM clinic WHERE id = 1",
  )!;
  run("UPDATE clinic SET next_invoice_seq = next_invoice_seq + 1 WHERE id = 1");
  return `${c.invoice_prefix}-${c.next_invoice_seq}`;
}

/** Recompute totals from line items and payments. Called after any change. */
function recalcInvoice(invoiceId: number) {
  const items = all<{ amount_cents: number; tax_bps: number }>(
    "SELECT amount_cents, tax_bps FROM invoice_items WHERE invoice_id = ?",
    invoiceId,
  );
  const subtotal = items.reduce((s, i) => s + i.amount_cents, 0);
  const tax = items.reduce((s, i) => s + Math.round((i.amount_cents * i.tax_bps) / 10000), 0);
  const paid = one<{ v: number }>(
    "SELECT COALESCE(SUM(amount_cents),0) AS v FROM payments WHERE invoice_id = ?",
    invoiceId,
  )!.v;
  const total = subtotal + tax;
  const current = one<{ status: string }>("SELECT status FROM invoices WHERE id = ?", invoiceId);
  const status =
    current?.status === "void" ? "void" : paid >= total && total > 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
  run(
    "UPDATE invoices SET subtotal_cents=?, tax_cents=?, total_cents=?, paid_cents=?, status=? WHERE id=?",
    subtotal, tax, total, paid, status, invoiceId,
  );
}

/** Build an invoice from a completed appointment. Safe to call twice. */
function createInvoiceForAppointment(appointmentId: number): number | null {
  const appt = one<Appointment>("SELECT * FROM appointments WHERE id = ?", appointmentId);
  if (!appt) return null;
  if (appt.invoice_id) return appt.invoice_id;

  const treatment = one<Treatment>("SELECT * FROM treatments WHERE id = ?", appt.treatment_id)!;
  return tx(() => {
    const number = nextInvoiceNumber();
    const invoiceId = run(
      `INSERT INTO invoices (number,patient_id,appointment_id,issued_on,due_on,status,
         subtotal_cents,tax_cents,total_cents,paid_cents)
       VALUES (?,?,?,?,?,'unpaid',0,0,0,0)`,
      number, appt.patient_id, appointmentId,
      appt.starts_at.slice(0, 10), appt.starts_at.slice(0, 10),
    );
    run(
      `INSERT INTO invoice_items (invoice_id,kind,description,quantity,unit_cents,tax_bps,amount_cents,treatment_id)
       VALUES (?,'treatment',?,1,?,?,?,?)`,
      invoiceId, treatment.name, treatment.price_cents, treatment.tax_bps,
      treatment.price_cents, treatment.id,
    );
    run("UPDATE appointments SET invoice_id = ? WHERE id = ?", invoiceId, appointmentId);
    recalcInvoice(invoiceId);
    audit("create", "invoice", invoiceId, number);
    return invoiceId;
  });
}

export async function invoiceAppointment(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const appointmentId = num(fd, "appointmentId");
  const id = createInvoiceForAppointment(appointmentId);
  if (!id) return { ok: false, error: "Could not create the invoice." };
  refreshEverywhere();
  return { ok: true, id, message: "Invoice created." };
}

export async function addInvoiceItem(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const invoiceId = num(fd, "invoiceId");
  const kind = str(fd, "kind") || "product";
  const productId = num(fd, "productId");
  const qty = Math.max(1, num(fd, "quantity") || 1);

  let description = str(fd, "description");
  let unit = cents(fd, "unit_price");
  let tax = 0;

  if (productId) {
    const p = one<{ name: string; price_cents: number; tax_bps: number }>(
      "SELECT name, price_cents, tax_bps FROM products WHERE id = ?",
      productId,
    );
    if (p) {
      description ||= p.name;
      unit ||= p.price_cents;
      tax = p.tax_bps;
      run("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", qty, productId);
    }
  }
  if (!description) return { ok: false, error: "Describe the line item." };

  run(
    `INSERT INTO invoice_items (invoice_id,kind,description,quantity,unit_cents,tax_bps,amount_cents,product_id)
     VALUES (?,?,?,?,?,?,?,?)`,
    invoiceId, kind, description, qty, unit, tax, unit * qty, productId || null,
  );
  recalcInvoice(invoiceId);
  audit("add_item", "invoice", invoiceId, description);
  revalidatePath(`/billing/${invoiceId}`);
  refreshEverywhere();
  return { ok: true, message: "Line item added." };
}

export async function removeInvoiceItem(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const itemId = num(fd, "itemId");
  const invoiceId = num(fd, "invoiceId");
  run("DELETE FROM invoice_items WHERE id = ?", itemId);
  recalcInvoice(invoiceId);
  revalidatePath(`/billing/${invoiceId}`);
  return { ok: true, message: "Line item removed." };
}

export async function recordPayment(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const invoiceId = num(fd, "invoiceId");
  const amount = cents(fd, "amount");
  if (amount <= 0) return { ok: false, error: "Enter an amount greater than zero." };

  const invoice = one<{ patient_id: number; total_cents: number; paid_cents: number; status: string }>(
    "SELECT patient_id, total_cents, paid_cents, status FROM invoices WHERE id = ?",
    invoiceId,
  );
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status === "void") return { ok: false, error: "This invoice has been voided." };

  const owing = invoice.total_cents - invoice.paid_cents;
  if (amount > owing) {
    return { ok: false, error: `That is more than the ${(owing / 100).toFixed(2)} still owing.` };
  }

  run(
    `INSERT INTO payments (invoice_id,patient_id,amount_cents,method,reference,received_on,note)
     VALUES (?,?,?,?,?,?,?)`,
    invoiceId, invoice.patient_id, amount,
    str(fd, "method") || "card", str(fd, "reference"),
    str(fd, "received_on") || todayKey(), str(fd, "note"),
  );
  recalcInvoice(invoiceId);
  audit("payment", "invoice", invoiceId, `${amount} cents`);
  revalidatePath(`/billing/${invoiceId}`);
  refreshEverywhere(invoice.patient_id);
  return { ok: true, message: "Payment recorded." };
}

export async function voidInvoice(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const invoiceId = num(fd, "invoiceId");
  const paid = one<{ paid_cents: number }>("SELECT paid_cents FROM invoices WHERE id = ?", invoiceId);
  if (paid && paid.paid_cents > 0) {
    return { ok: false, error: "Refund the payments on this invoice before voiding it." };
  }
  run("UPDATE invoices SET status = 'void' WHERE id = ?", invoiceId);
  audit("void", "invoice", invoiceId);
  revalidatePath(`/billing/${invoiceId}`);
  refreshEverywhere();
  return { ok: true, message: "Invoice voided." };
}

export async function submitClaim(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const invoiceId = num(fd, "invoiceId");
  const policyId = num(fd, "policyId");
  const invoice = one<{ patient_id: number; total_cents: number; paid_cents: number }>(
    "SELECT patient_id, total_cents, paid_cents FROM invoices WHERE id = ?",
    invoiceId,
  );
  if (!invoice) return { ok: false, error: "Invoice not found." };

  const policy = one<{ insurer_name: string; coverage_percent: number }>(
    "SELECT insurer_name, coverage_percent FROM insurance_policies WHERE id = ?",
    policyId,
  );
  if (!policy) return { ok: false, error: "Choose a policy to bill." };

  const owing = invoice.total_cents - invoice.paid_cents;
  const billed = Math.min(owing, cents(fd, "amount") || owing);
  const id = run(
    `INSERT INTO claims (invoice_id,patient_id,policy_id,insurer_name,submitted_on,status,billed_cents,approved_cents,paid_cents)
     VALUES (?,?,?,?,?,'submitted',?,?,0)`,
    invoiceId, invoice.patient_id, policyId, policy.insurer_name, todayKey(),
    billed, Math.round((billed * policy.coverage_percent) / 100),
  );
  audit("submit", "claim", id, policy.insurer_name);
  revalidatePath(`/billing/${invoiceId}`);
  revalidatePath("/billing");
  return { ok: true, id, message: `Claim submitted to ${policy.insurer_name}.` };
}

export async function settleClaim(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const claimId = num(fd, "claimId");
  const outcome = str(fd, "outcome"); // paid | rejected
  const claim = one<{ invoice_id: number; patient_id: number; approved_cents: number; insurer_name: string }>(
    "SELECT invoice_id, patient_id, approved_cents, insurer_name FROM claims WHERE id = ?",
    claimId,
  );
  if (!claim) return { ok: false, error: "Claim not found." };

  if (outcome === "rejected") {
    run(
      "UPDATE claims SET status='rejected', responded_on=?, paid_cents=0, adjudication=? WHERE id=?",
      todayKey(), str(fd, "adjudication") || "Declined by insurer.", claimId,
    );
  } else {
    const paid = cents(fd, "amount") || claim.approved_cents;
    run(
      "UPDATE claims SET status='paid', responded_on=?, paid_cents=?, adjudication=? WHERE id=?",
      todayKey(), paid, str(fd, "adjudication") || "Paid to provider.", claimId,
    );
    run(
      `INSERT INTO payments (invoice_id,patient_id,amount_cents,method,reference,received_on,note)
       VALUES (?,?,?,'insurer',?,?,?)`,
      claim.invoice_id, claim.patient_id, paid,
      str(fd, "reference"), todayKey(), `${claim.insurer_name} remittance`,
    );
    recalcInvoice(claim.invoice_id);
  }
  audit("settle", "claim", claimId, outcome);
  revalidatePath("/billing");
  revalidatePath(`/billing/${claim.invoice_id}`);
  return { ok: true, message: outcome === "paid" ? "Remittance applied." : "Claim marked rejected." };
}

/* ------------------------------------------------------------------ *
 * Communications & tasks
 * ------------------------------------------------------------------ */

export async function logCommunication(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const patientId = num(fd, "patientId");
  const body = str(fd, "body");
  if (!body) return { ok: false, error: "Nothing to log." };
  const id = run(
    "INSERT INTO communications (patient_id,kind,direction,subject,body,author,created_at) VALUES (?,?,?,?,?,?,?)",
    patientId, str(fd, "kind") || "note", str(fd, "direction") || "out",
    str(fd, "subject"), body, "Front desk", todayKey(),
  );
  revalidatePath(`/patients/${patientId}`);
  return { ok: true, id, message: "Logged." };
}

export async function saveTask(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "taskId");
  const title = str(fd, "title");
  if (!title) return { ok: false, error: "Give the task a title." };
  if (id) {
    run(
      "UPDATE tasks SET title=?, detail=?, due_on=?, assignee_id=?, status=? WHERE id=?",
      title, str(fd, "detail"), str(fd, "due_on"),
      num(fd, "assignee_id") || null, str(fd, "status") || "open", id,
    );
  } else {
    run(
      "INSERT INTO tasks (title,detail,due_on,assignee_id,patient_id,status,created_at) VALUES (?,?,?,?,?,'open',?)",
      title, str(fd, "detail"), str(fd, "due_on"),
      num(fd, "assignee_id") || null, num(fd, "patientId") || null, todayKey(),
    );
  }
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  return { ok: true, message: "Task saved." };
}

export async function toggleTask(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "taskId");
  run("UPDATE tasks SET status = CASE status WHEN 'open' THEN 'done' ELSE 'open' END WHERE id = ?", id);
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export async function saveClinic(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "The clinic needs a name." };

  // Upsert rather than update: a fresh database has no clinic row, and a plain
  // UPDATE would match nothing while still reporting success.
  run(
    `INSERT INTO clinic (id,name,tagline,email,phone,website,timezone,currency,
       booking_lead_hours,cancellation_hours,cancellation_fee_cents,default_tax_bps,
       invoice_prefix,next_invoice_seq)
     VALUES (1,?,?,?,?,?,?,'CAD',?,?,?,0,?,1001)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, tagline=excluded.tagline, email=excluded.email,
       phone=excluded.phone, website=excluded.website, timezone=excluded.timezone,
       booking_lead_hours=excluded.booking_lead_hours,
       cancellation_hours=excluded.cancellation_hours,
       cancellation_fee_cents=excluded.cancellation_fee_cents,
       invoice_prefix=excluded.invoice_prefix`,
    name, str(fd, "tagline"), str(fd, "email"), str(fd, "phone"),
    str(fd, "website"), str(fd, "timezone") || "America/Vancouver",
    num(fd, "booking_lead_hours"), num(fd, "cancellation_hours"),
    cents(fd, "cancellation_fee"), str(fd, "invoice_prefix") || "CMX",
  );
  audit("update", "clinic", 1);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Clinic settings saved." };
}

export async function saveTreatment(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "treatmentId");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Give the treatment a name." };
  const values = [
    name,
    num(fd, "discipline_id"),
    Math.max(5, num(fd, "duration_min")),
    cents(fd, "price"),
    num(fd, "tax_bps"),
    str(fd, "description"),
    bool(fd, "online_bookable"),
    bool(fd, "is_active"),
  ];
  if (id) {
    run(
      `UPDATE treatments SET name=?,discipline_id=?,duration_min=?,price_cents=?,tax_bps=?,
         description=?,online_bookable=?,is_active=? WHERE id=?`,
      ...values, id,
    );
  } else {
    const newId = run(
      `INSERT INTO treatments (name,discipline_id,duration_min,price_cents,tax_bps,description,online_bookable,is_active)
       VALUES (?,?,?,?,?,?,?,?)`,
      ...values,
    );
    // Offer it to everyone in that discipline by default.
    const pracs = all<{ id: number }>(
      "SELECT id FROM practitioners WHERE discipline_id = ?",
      num(fd, "discipline_id"),
    );
    for (const p of pracs) {
      run("INSERT OR IGNORE INTO practitioner_treatments (practitioner_id,treatment_id) VALUES (?,?)", p.id, newId);
    }
  }
  audit("save", "treatment", id || undefined, name);
  revalidatePath("/settings");
  revalidatePath("/book");
  return { ok: true, message: "Treatment saved." };
}

export async function savePractitioner(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "practitionerId");
  const first = str(fd, "first_name");
  const last = str(fd, "last_name");
  if (!first || !last) return { ok: false, error: "First and last name are required." };

  const values = [
    first, last, str(fd, "credentials"), num(fd, "discipline_id"),
    str(fd, "email"), str(fd, "phone"), str(fd, "bio"),
    str(fd, "color") || "teal", str(fd, "role") || "practitioner",
    num(fd, "location_id") || null, bool(fd, "online_booking"), bool(fd, "is_active"),
  ];
  if (id) {
    run(
      `UPDATE practitioners SET first_name=?,last_name=?,credentials=?,discipline_id=?,email=?,phone=?,
         bio=?,color=?,role=?,location_id=?,online_booking=?,is_active=? WHERE id=?`,
      ...values, id,
    );
  } else {
    const newId = run(
      `INSERT INTO practitioners (first_name,last_name,credentials,discipline_id,email,phone,bio,color,role,
         location_id,online_booking,is_active,started_on)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ...values, todayKey(),
    );
    const treatments = all<{ id: number }>(
      "SELECT id FROM treatments WHERE discipline_id = ?",
      num(fd, "discipline_id"),
    );
    for (const t of treatments) {
      run("INSERT OR IGNORE INTO practitioner_treatments (practitioner_id,treatment_id) VALUES (?,?)", newId, t.id);
    }
    // A sensible Monday-to-Friday default the clinic can edit.
    for (let wd = 1; wd <= 5; wd++) {
      run(
        "INSERT INTO availability (practitioner_id,location_id,weekday,start_min,end_min) VALUES (?,?,?,?,?)",
        newId, num(fd, "location_id") || null, wd, 9 * 60, 17 * 60,
      );
    }
  }
  audit("save", "practitioner", id || undefined, `${first} ${last}`);
  revalidatePath("/staff");
  revalidatePath("/schedule");
  revalidatePath("/book");
  return { ok: true, message: "Practitioner saved." };
}

export async function saveAvailability(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const practitionerId = num(fd, "practitionerId");
  if (!practitionerId) return { ok: false, error: "Missing practitioner." };

  const parse = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return Number.isFinite(h) ? h * 60 + (m || 0) : null;
  };

  run("DELETE FROM availability WHERE practitioner_id = ?", practitionerId);
  const locationId = num(fd, "location_id") || null;
  for (let wd = 0; wd <= 6; wd++) {
    if (!fd.get(`on:${wd}`)) continue;
    const start = parse(str(fd, `start:${wd}`));
    const end = parse(str(fd, `end:${wd}`));
    if (start === null || end === null || end <= start) continue;
    run(
      "INSERT INTO availability (practitioner_id,location_id,weekday,start_min,end_min) VALUES (?,?,?,?,?)",
      practitionerId, locationId, wd, start, end,
    );
  }
  audit("update", "availability", practitionerId);
  revalidatePath("/staff");
  revalidatePath("/schedule");
  return { ok: true, message: "Working hours updated." };
}

export async function saveProduct(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "productId");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Give the product a name." };
  const values = [name, str(fd, "sku"), cents(fd, "price"), cents(fd, "cost"), num(fd, "stock"), num(fd, "tax_bps")];
  if (id) {
    run("UPDATE products SET name=?,sku=?,price_cents=?,cost_cents=?,stock=?,tax_bps=? WHERE id=?", ...values, id);
  } else {
    run("INSERT INTO products (name,sku,price_cents,cost_cents,stock,tax_bps) VALUES (?,?,?,?,?,?)", ...values);
  }
  revalidatePath("/settings");
  return { ok: true, message: "Product saved." };
}

export async function saveLocation(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const id = num(fd, "locationId");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Give the location a name." };
  const values = [name, str(fd, "address"), str(fd, "city"), str(fd, "region"), str(fd, "postal_code"), str(fd, "phone")];
  if (id) {
    run("UPDATE locations SET name=?,address=?,city=?,region=?,postal_code=?,phone=? WHERE id=?", ...values, id);
  } else {
    run("INSERT INTO locations (name,address,city,region,postal_code,phone) VALUES (?,?,?,?,?,?)", ...values);
  }
  revalidatePath("/settings");
  return { ok: true, message: "Location saved." };
}

/* ------------------------------------------------------------------ *
 * Public online booking
 * ------------------------------------------------------------------ */

export async function bookOnline(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const email = str(fd, "email").toLowerCase();
  const firstName = str(fd, "first_name");
  const lastName = str(fd, "last_name");
  const phone = str(fd, "phone");

  if (!firstName || !lastName) return { ok: false, error: "Please give your first and last name." };
  if (!email) return { ok: false, error: "We need an email to send your confirmation." };

  let patient = one<{ id: number }>("SELECT id FROM patients WHERE LOWER(email) = ?", email);
  if (!patient) {
    const id = run(
      `INSERT INTO patients (first_name,last_name,email,phone,referral_source,created_at)
       VALUES (?,?,?,?, 'Online booking', ?)`,
      firstName, lastName, email, phone, todayKey(),
    );
    patient = { id };
  }

  const booking = new FormData();
  booking.set("patientId", String(patient.id));
  booking.set("practitionerId", str(fd, "practitionerId"));
  booking.set("treatmentId", str(fd, "treatmentId"));
  booking.set("date", str(fd, "date"));
  booking.set("time", str(fd, "time"));
  booking.set("source", "online");
  booking.set("notes", str(fd, "notes"));

  const result = await bookAppointment(null, booking);
  if (!result.ok) return result;

  run(
    "INSERT INTO communications (patient_id,kind,direction,subject,body,author,created_at) VALUES (?,?,?,?,?,?,?)",
    patient.id, "email", "out", "Booking confirmation",
    `Confirmation sent for ${str(fd, "date")} at ${str(fd, "time")}.`,
    "Online booking", todayKey(),
  );
  return { ok: true, id: result.id, message: "Booked" };
}
