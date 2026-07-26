import "server-only";
import { all } from "./db";
import { addDays, parseLocal, toDateKey } from "./format";

export interface DayOffer {
  date: string;
  slots: string[]; // "HH:MM"
}

/**
 * Free start times for a practitioner + treatment over the next `days` days.
 *
 * A slot is offered when the whole appointment fits inside a working block, it
 * doesn't collide with an existing booking, and it clears the clinic's minimum
 * booking notice.
 */
export function openSlots({
  practitionerId,
  durationMin,
  fromDate,
  days = 21,
  leadHours = 2,
  granularityMin = 15,
}: {
  practitionerId: number;
  durationMin: number;
  fromDate: string;
  days?: number;
  leadHours?: number;
  granularityMin?: number;
}): DayOffer[] {
  const shifts = all<{ weekday: number; start_min: number; end_min: number }>(
    "SELECT weekday, start_min, end_min FROM availability WHERE practitioner_id = ?",
    practitionerId,
  );
  if (!shifts.length) return [];

  const until = addDays(fromDate, days);
  const booked = all<{ starts_at: string; ends_at: string }>(
    `SELECT starts_at, ends_at FROM appointments
      WHERE practitioner_id = ? AND status != 'cancelled'
        AND starts_at >= ? AND starts_at < ?`,
    practitionerId, `${fromDate}T00:00`, `${until}T00:00`,
  );

  const busyByDay = new Map<string, Array<[number, number]>>();
  for (const b of booked) {
    const day = b.starts_at.slice(0, 10);
    const toMin = (s: string) => Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));
    const list = busyByDay.get(day) ?? [];
    list.push([toMin(b.starts_at), toMin(b.ends_at)]);
    busyByDay.set(day, list);
  }

  const now = new Date();
  const earliest = new Date(now.getTime() + leadHours * 3_600_000);

  const offers: DayOffer[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const weekday = parseLocal(date).getDay();
    const dayShifts = shifts.filter((s) => s.weekday === weekday);
    if (!dayShifts.length) continue;

    const busy = busyByDay.get(date) ?? [];
    const slots: string[] = [];

    for (const shift of dayShifts) {
      for (let m = shift.start_min; m + durationMin <= shift.end_min; m += granularityMin) {
        const end = m + durationMin;
        // Keep the midday break clear.
        if (m < 12 * 60 + 45 && end > 12 * 60) continue;
        if (busy.some(([bs, be]) => m < be && bs < end)) continue;

        const at = parseLocal(date);
        at.setMinutes(m);
        if (at < earliest) continue;

        slots.push(
          `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
        );
      }
    }
    if (slots.length) offers.push({ date, slots });
  }

  return offers;
}

export function todayForBooking(): string {
  return toDateKey(new Date());
}
