/**
 * Practitioner / discipline colour tokens.
 *
 * The colour name lives in the database as a plain string, so every Tailwind
 * class has to appear here as a complete literal — that is what the compiler
 * scans for. Never build these class names by interpolation.
 */

export interface ColorSet {
  /** Filled chip — used for appointment blocks. */
  block: string;
  /** Softer tint — used for list rows and badges. */
  soft: string;
  /** Text-only accent. */
  text: string;
  /** Solid swatch for avatars and legend dots. */
  solid: string;
  /** Left accent bar. */
  bar: string;
}

const PALETTE: Record<string, ColorSet> = {
  teal: {
    block: "bg-teal-50 border-teal-300 text-teal-900 hover:bg-teal-100",
    soft: "bg-teal-50 text-teal-800 border-teal-200",
    text: "text-teal-700",
    solid: "bg-teal-600 text-white",
    bar: "bg-teal-500",
  },
  emerald: {
    block: "bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100",
    soft: "bg-emerald-50 text-emerald-800 border-emerald-200",
    text: "text-emerald-700",
    solid: "bg-emerald-600 text-white",
    bar: "bg-emerald-500",
  },
  amber: {
    block: "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100",
    soft: "bg-amber-50 text-amber-800 border-amber-200",
    text: "text-amber-700",
    solid: "bg-amber-500 text-white",
    bar: "bg-amber-500",
  },
  orange: {
    block: "bg-orange-50 border-orange-300 text-orange-900 hover:bg-orange-100",
    soft: "bg-orange-50 text-orange-800 border-orange-200",
    text: "text-orange-700",
    solid: "bg-orange-500 text-white",
    bar: "bg-orange-500",
  },
  violet: {
    block: "bg-violet-50 border-violet-300 text-violet-900 hover:bg-violet-100",
    soft: "bg-violet-50 text-violet-800 border-violet-200",
    text: "text-violet-700",
    solid: "bg-violet-600 text-white",
    bar: "bg-violet-500",
  },
  indigo: {
    block: "bg-indigo-50 border-indigo-300 text-indigo-900 hover:bg-indigo-100",
    soft: "bg-indigo-50 text-indigo-800 border-indigo-200",
    text: "text-indigo-700",
    solid: "bg-indigo-600 text-white",
    bar: "bg-indigo-500",
  },
  rose: {
    block: "bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100",
    soft: "bg-rose-50 text-rose-800 border-rose-200",
    text: "text-rose-700",
    solid: "bg-rose-500 text-white",
    bar: "bg-rose-500",
  },
  sky: {
    block: "bg-sky-50 border-sky-300 text-sky-900 hover:bg-sky-100",
    soft: "bg-sky-50 text-sky-800 border-sky-200",
    text: "text-sky-700",
    solid: "bg-sky-600 text-white",
    bar: "bg-sky-500",
  },
  slate: {
    block: "bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100",
    soft: "bg-slate-100 text-slate-700 border-slate-200",
    text: "text-slate-600",
    solid: "bg-slate-600 text-white",
    bar: "bg-slate-400",
  },
};

export function colorSet(name: string | null | undefined): ColorSet {
  return PALETTE[name ?? "teal"] ?? PALETTE.teal;
}

export const COLOR_NAMES = Object.keys(PALETTE);

/* Status colouring for appointments, invoices and claims. */

export const APPOINTMENT_STATUS: Record<string, { label: string; chip: string }> = {
  booked: { label: "Booked", chip: "bg-white text-ink-500 border-line" },
  arrived: { label: "Arrived", chip: "bg-brand-100 text-brand-800 border-brand-300" },
  completed: { label: "Completed", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelled", chip: "bg-slate-100 text-slate-500 border-slate-200" },
  no_show: { label: "No show", chip: "bg-rose-50 text-rose-700 border-rose-200" },
};

export const INVOICE_STATUS: Record<string, { label: string; chip: string }> = {
  unpaid: { label: "Unpaid", chip: "bg-rose-50 text-rose-700 border-rose-200" },
  partial: { label: "Partial", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  paid: { label: "Paid", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  void: { label: "Void", chip: "bg-slate-100 text-slate-500 border-slate-200" },
};

export const CLAIM_STATUS: Record<string, { label: string; chip: string }> = {
  draft: { label: "Draft", chip: "bg-slate-100 text-slate-600 border-slate-200" },
  submitted: { label: "Submitted", chip: "bg-sky-50 text-sky-700 border-sky-200" },
  accepted: { label: "Accepted", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  paid: { label: "Paid", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", chip: "bg-rose-50 text-rose-700 border-rose-200" },
};
