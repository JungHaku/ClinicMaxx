/** What every server action hands back to the form that called it. */
export type ActionResult =
  | { ok: true; id?: number; message?: string }
  | { ok: false; error: string };

export type AppointmentStatus =
  | "booked"
  | "arrived"
  | "completed"
  | "cancelled"
  | "no_show";

export type InvoiceStatus = "unpaid" | "partial" | "paid" | "void";
export type ClaimStatus = "draft" | "submitted" | "accepted" | "paid" | "rejected";
export type PaymentMethod = "card" | "cash" | "etransfer" | "insurer" | "credit";
export type NoteStatus = "draft" | "signed";

export interface Clinic {
  id: number;
  name: string;
  tagline: string;
  email: string;
  phone: string;
  website: string;
  timezone: string;
  currency: string;
  booking_lead_hours: number;
  cancellation_hours: number;
  cancellation_fee_cents: number;
  default_tax_bps: number;
  invoice_prefix: string;
  next_invoice_seq: number;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  region: string;
  postal_code: string;
  phone: string;
  is_active: number;
}

export interface Discipline {
  id: number;
  name: string;
  color: string;
  description: string;
}

export interface Practitioner {
  id: number;
  first_name: string;
  last_name: string;
  credentials: string;
  discipline_id: number;
  email: string;
  phone: string;
  bio: string;
  color: string;
  role: string;
  location_id: number | null;
  online_booking: number;
  is_active: number;
  started_on: string;
}

export interface PractitionerView extends Practitioner {
  discipline: string;
}

export interface Availability {
  id: number;
  practitioner_id: number;
  location_id: number | null;
  weekday: number;
  start_min: number;
  end_min: number;
}

export interface Treatment {
  id: number;
  name: string;
  discipline_id: number;
  duration_min: number;
  price_cents: number;
  tax_bps: number;
  description: string;
  online_bookable: number;
  is_active: number;
}

export interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  preferred_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  pronouns: string;
  address: string;
  city: string;
  region: string;
  postal_code: string;
  emergency_name: string;
  emergency_phone: string;
  occupation: string;
  referral_source: string;
  family_doctor: string;
  alert: string;
  tags: string;
  notes: string;
  intake_completed: number;
  consent_signed: number;
  is_active: number;
  created_at: string;
}

export interface InsurancePolicy {
  id: number;
  patient_id: number;
  insurer_name: string;
  plan_type: string;
  policy_number: string;
  member_id: string;
  coverage_percent: number;
  annual_max_cents: number;
  used_cents: number;
  visits_allowed: number;
  visits_used: number;
  direct_billing: number;
  is_primary: number;
  valid_to: string;
}

export interface Appointment {
  id: number;
  patient_id: number;
  practitioner_id: number;
  treatment_id: number;
  location_id: number | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: string;
  is_first_visit: number;
  notes: string;
  cancel_reason: string;
  reminder_sent: number;
  invoice_id: number | null;
  created_at: string;
}

/** An appointment joined with the names a human needs to read it. */
export interface AppointmentView extends Appointment {
  patient_name: string;
  patient_phone: string;
  practitioner_name: string;
  practitioner_color: string;
  treatment_name: string;
  duration_min: number;
  price_cents: number;
  location_name: string | null;
  discipline: string;
  has_note: number;
}

export interface ChartTemplate {
  id: number;
  name: string;
  discipline_id: number | null;
  kind: string;
  fields_json: string;
}

export interface ChartField {
  key: string;
  label: string;
  type: "text" | "textarea" | "scale" | "checkbox";
  placeholder?: string;
  hint?: string;
}

export interface ChartNote {
  id: number;
  patient_id: number;
  practitioner_id: number;
  appointment_id: number | null;
  template_id: number | null;
  title: string;
  body_json: string;
  status: NoteStatus;
  signed_at: string;
  created_at: string;
  updated_at: string;
}

export interface ChartNoteView extends ChartNote {
  practitioner_name: string;
  credentials: string;
  template_name: string | null;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  price_cents: number;
  cost_cents: number;
  stock: number;
  tax_bps: number;
  is_active: number;
}

export interface Invoice {
  id: number;
  number: string;
  patient_id: number;
  appointment_id: number | null;
  issued_on: string;
  due_on: string;
  status: InvoiceStatus;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  paid_cents: number;
  notes: string;
}

export interface InvoiceView extends Invoice {
  patient_name: string;
  balance_cents: number;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  kind: string;
  description: string;
  quantity: number;
  unit_cents: number;
  tax_bps: number;
  amount_cents: number;
  treatment_id: number | null;
  product_id: number | null;
}

export interface Payment {
  id: number;
  invoice_id: number;
  patient_id: number;
  amount_cents: number;
  method: PaymentMethod;
  reference: string;
  received_on: string;
  note: string;
}

export interface Claim {
  id: number;
  invoice_id: number;
  patient_id: number;
  policy_id: number | null;
  insurer_name: string;
  submitted_on: string;
  responded_on: string;
  status: ClaimStatus;
  billed_cents: number;
  approved_cents: number;
  paid_cents: number;
  adjudication: string;
}

export interface ClaimView extends Claim {
  patient_name: string;
  invoice_number: string;
}

export interface Communication {
  id: number;
  patient_id: number;
  kind: string;
  direction: string;
  subject: string;
  body: string;
  author: string;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  detail: string;
  due_on: string;
  assignee_id: number | null;
  patient_id: number | null;
  status: string;
  created_at: string;
}

export interface TaskView extends Task {
  assignee_name: string | null;
  patient_name: string | null;
}
