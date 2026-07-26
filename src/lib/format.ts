/** Formatting helpers shared by server and client components. */

export function money(cents: number, currency = "CAD"): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format((cents ?? 0) / 100);
}

/** Compact money for dense tables and stat tiles: $1.2k */
export function moneyShort(cents: number): string {
  const v = (cents ?? 0) / 100;
  if (Math.abs(v) >= 10000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(v % 1 === 0 ? 0 : 2)}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parse 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' as *local* time, never UTC. */
export function parseLocal(value: string): Date {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export function toDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function toStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${toDateKey(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** 'Jul 25, 2026' */
export function fmtDate(value: string): string {
  if (!value) return "—";
  const d = parseLocal(value);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** 'Sat, Jul 25' */
export function fmtDateShort(value: string): string {
  if (!value) return "—";
  const d = parseLocal(value);
  return `${DAYS[d.getDay()].slice(0, 3)}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** 'Saturday, July 25, 2026' */
export function fmtDateLong(value: string): string {
  if (!value) return "—";
  const d = parseLocal(value);
  const full = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${DAYS[d.getDay()]}, ${full[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** '2:30 pm' from a stamp or from minutes-since-midnight. */
export function fmtTime(value: string | number): string {
  let h: number, m: number;
  if (typeof value === "number") {
    h = Math.floor(value / 60);
    m = value % 60;
  } else {
    const t = value.includes("T") ? value.split("T")[1] : value;
    [h, m] = t.split(":").map(Number);
  }
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export function fmtTimeRange(startStamp: string, endStamp: string): string {
  return `${fmtTime(startStamp)} – ${fmtTime(endStamp)}`;
}

export function minutesOf(stamp: string): number {
  const [h, m] = stamp.split("T")[1].split(":").map(Number);
  return h * 60 + m;
}

export function addMinutes(stamp: string, mins: number): string {
  const d = parseLocal(stamp);
  d.setMinutes(d.getMinutes() + mins);
  return toStamp(d);
}

export function addDays(dateKey: string, days: number): string {
  const d = parseLocal(dateKey);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function startOfWeek(dateKey: string): string {
  const d = parseLocal(dateKey);
  d.setDate(d.getDate() - d.getDay());
  return toDateKey(d);
}

export function age(dob: string): number | null {
  if (!dob) return null;
  const b = parseLocal(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const before =
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate());
  if (before) a -= 1;
  return a;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** 'in 3 days' / '2 days ago' / 'today' */
export function relativeDay(dateKey: string): string {
  const diff = Math.round(
    (parseLocal(dateKey).getTime() - parseLocal(toDateKey(new Date())).getTime()) / 86_400_000,
  );
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

export function duration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
