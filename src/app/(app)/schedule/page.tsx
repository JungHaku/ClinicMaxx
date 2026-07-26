import Link from "next/link";
import { CalendarX2, FileText, Globe, MapPin, Phone, Receipt, StickyNote, User } from "lucide-react";
import { Badge, Card, DetailRow, EmptyState, LinkButton } from "@/components/ui";
import { Dialog } from "@/components/Dialog";
import { ScheduleToolbar } from "@/components/schedule/ScheduleToolbar";
import { DayGrid, type Column } from "@/components/schedule/DayGrid";
import { BookingForm, type BookingTreatment } from "@/components/schedule/BookingForm";
import { AppointmentActions } from "@/components/schedule/AppointmentActions";
import {
  appointmentsBetween,
  getAppointment,
  getPatient,
  listAvailability,
  listPractitioners,
  listTreatments,
  noteForAppointment,
} from "@/lib/queries";
import { all } from "@/lib/db";
import {
  addDays,
  fmtDate,
  fmtDateShort,
  fmtTime,
  fmtTimeRange,
  money,
  parseLocal,
  startOfWeek,
  todayKey,
} from "@/lib/format";
import { APPOINTMENT_STATUS } from "@/lib/colors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule" };

type Search = Promise<Record<string, string | string[] | undefined>>;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SchedulePage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) as string | undefined;

  const date = pick("date") ?? todayKey();
  const view = pick("view") === "week" ? "week" : "day";
  const selected = (pick("prac") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  const practitioners = listPractitioners().filter((p) => p.role !== "admin");
  const shown = selected.length
    ? practitioners.filter((p) => selected.includes(p.id))
    : practitioners;

  const rangeStart = view === "week" ? startOfWeek(date) : date;
  const rangeEnd = view === "week" ? addDays(rangeStart, 7) : addDays(date, 1);

  const appts = appointmentsBetween(rangeStart, rangeEnd, {
    practitionerIds: shown.map((p) => p.id),
    includeCancelled: true,
  });

  const availability = new Map(
    shown.map((p) => [p.id, listAvailability(p.id)]),
  );

  /* ----------------------------------------------- build the columns */
  let columns: Column[] = [];
  let windowStart = 8 * 60;
  let windowEnd = 19 * 60;

  if (view === "day") {
    const weekday = parseLocal(date).getDay();
    columns = shown.map((p) => {
      const shifts = (availability.get(p.id) ?? [])
        .filter((a) => a.weekday === weekday)
        .map((a) => ({ start: a.start_min, end: a.end_min }));
      return {
        key: `p${p.id}`,
        title: `${p.first_name} ${p.last_name}`,
        subtitle: p.discipline,
        color: p.color,
        bookParams: { date, p: String(p.id) },
        shifts,
        appointments: appts.filter((a) => a.practitioner_id === p.id),
      };
    });
    // Someone who isn't working today only clutters the grid — unless the
    // filter chips explicitly asked for them.
    if (!selected.length) {
      const working = columns.filter((c) => c.shifts.length || c.appointments.length);
      if (working.length) columns = working;
    }
  } else {
    const days = Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));
    columns = days.map((d) => {
      const weekday = parseLocal(d).getDay();
      const shifts = shown.flatMap((p) =>
        (availability.get(p.id) ?? [])
          .filter((a) => a.weekday === weekday)
          .map((a) => ({ start: a.start_min, end: a.end_min })),
      );
      return {
        key: d,
        title: DAY_NAMES[weekday].slice(0, 3),
        subtitle: fmtDate(d).replace(/, \d{4}$/, ""),
        color: d === todayKey() ? "teal" : "slate",
        bookParams: { date: d, p: String(shown[0]?.id ?? "") },
        shifts,
        appointments: appts.filter((a) => a.starts_at.startsWith(d)),
      };
    });
  }

  // Fit the grid to the day's real working hours, with an hour of padding.
  const allShifts = columns.flatMap((c) => c.shifts);
  const allBlocks = columns.flatMap((c) => c.appointments);
  if (allShifts.length || allBlocks.length) {
    const starts = [
      ...allShifts.map((s) => s.start),
      ...allBlocks.map((a) => Number(a.starts_at.slice(11, 13)) * 60 + Number(a.starts_at.slice(14, 16))),
    ];
    const ends = [
      ...allShifts.map((s) => s.end),
      ...allBlocks.map((a) => Number(a.ends_at.slice(11, 13)) * 60 + Number(a.ends_at.slice(14, 16))),
    ];
    windowStart = Math.max(0, Math.floor(Math.min(...starts) / 60) * 60 - 30);
    windowEnd = Math.min(24 * 60, Math.ceil(Math.max(...ends) / 60) * 60 + 30);
  }

  const baseParams = new URLSearchParams();
  baseParams.set("date", date);
  baseParams.set("view", view);
  if (selected.length) baseParams.set("prac", selected.join(","));
  const baseHref = `/schedule?${baseParams.toString()}`;

  /* ------------------------------------------------------- overlays */
  const apptId = Number(pick("appt") ?? 0);
  const openAppt = apptId ? getAppointment(apptId) : undefined;
  const showBooking = pick("book") === "1";

  const treatments: BookingTreatment[] = listTreatments().map((t) => ({
    ...t,
    practitionerIds: all<{ practitioner_id: number }>(
      "SELECT practitioner_id FROM practitioner_treatments WHERE treatment_id = ?",
      t.id,
    ).map((r) => r.practitioner_id),
  }));

  const note = openAppt ? noteForAppointment(openAppt.id) : undefined;
  const apptPatient = openAppt ? getPatient(openAppt.patient_id) : undefined;

  const dayTotal = allBlocks
    .filter((a) => a.status !== "cancelled")
    .reduce((s, a) => s + a.price_cents, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">Schedule</h1>
          <p className="mt-1 text-[13.5px] text-ink-400">
            {allBlocks.filter((a) => a.status !== "cancelled").length} appointments ·{" "}
            {money(dayTotal)} booked
            {view === "week" ? " this week" : ""}
          </p>
        </div>
        <LinkButton href={`${baseHref}&book=1`} variant="primary" size="sm">
          New booking
        </LinkButton>
      </div>

      <ScheduleToolbar date={date} view={view} practitioners={practitioners} selected={selected} />

      {columns.length === 0 ? (
        <EmptyState
          title="No practitioners selected"
          body="Pick at least one practitioner to see their column."
          icon={<CalendarX2 className="size-8" />}
        />
      ) : (
        <DayGrid
          columns={columns}
          windowStart={windowStart}
          windowEnd={windowEnd}
          baseHref={baseHref}
          date={date}
          showNowLine={view === "day" && date === todayKey()}
        />
      )}

      {/* ------------------------------------------------ new booking */}
      {showBooking ? (
        <Dialog
          title="New appointment"
          subtitle="Double bookings are blocked automatically."
          closeHref={baseHref}
          width="md"
        >
          <BookingForm
            practitioners={practitioners}
            treatments={treatments}
            closeHref={baseHref}
            defaults={{
              date: pick("date") ?? date,
              time: pick("time") ?? "09:00",
              practitionerId: Number(pick("p") ?? 0) || practitioners[0]?.id,
            }}
          />
        </Dialog>
      ) : null}

      {/* ------------------------------------------- appointment card */}
      {openAppt ? (
        <Dialog
          title={openAppt.patient_name}
          subtitle={`${fmtDateShort(openAppt.starts_at)} · ${fmtTimeRange(openAppt.starts_at, openAppt.ends_at)}`}
          closeHref={baseHref}
          width="md"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${APPOINTMENT_STATUS[openAppt.status].chip}`}
              >
                {APPOINTMENT_STATUS[openAppt.status].label}
              </span>
              {openAppt.source === "online" ? (
                <Badge tone="brand">
                  <Globe className="size-3" /> Booked online
                </Badge>
              ) : null}
              {openAppt.is_first_visit ? <Badge tone="brand">First visit</Badge> : null}
              {openAppt.status === "completed" && !openAppt.has_note ? (
                <Badge tone="warn">Chart note missing</Badge>
              ) : null}
            </div>

            {apptPatient?.alert ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                <strong className="font-semibold">Alert · </strong>
                {apptPatient.alert}
              </p>
            ) : null}

            <Card padded={false} className="p-4">
              <dl>
                <DetailRow label="Treatment">{openAppt.treatment_name}</DetailRow>
                <DetailRow label="Practitioner">
                  {openAppt.practitioner_name} · {openAppt.discipline}
                </DetailRow>
                <DetailRow label="Location">{openAppt.location_name ?? "—"}</DetailRow>
                <DetailRow label="Fee">{money(openAppt.price_cents)}</DetailRow>
                <DetailRow label="Phone">{openAppt.patient_phone || "—"}</DetailRow>
                {openAppt.cancel_reason ? (
                  <DetailRow label="Cancellation">{openAppt.cancel_reason}</DetailRow>
                ) : null}
              </dl>
            </Card>

            {openAppt.notes ? (
              <p className="flex items-start gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink-700">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-ink-300" />
                {openAppt.notes}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/patients/${openAppt.patient_id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-700 hover:bg-brand-50"
              >
                <User className="size-4" /> Client file
              </Link>
              <Link
                href={
                  note
                    ? `/patients/${openAppt.patient_id}?tab=chart&note=${note.id}`
                    : `/patients/${openAppt.patient_id}?tab=chart&new=1&appt=${openAppt.id}`
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-700 hover:bg-brand-50"
              >
                <FileText className="size-4" /> {note ? "Open chart note" : "Start chart note"}
              </Link>
              {openAppt.invoice_id ? (
                <Link
                  href={`/billing/${openAppt.invoice_id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-700 hover:bg-brand-50"
                >
                  <Receipt className="size-4" /> Invoice
                </Link>
              ) : null}
              {openAppt.location_name ? (
                <span className="inline-flex items-center gap-1.5 px-1 py-1.5 text-[13px] text-ink-400">
                  <MapPin className="size-4" /> {openAppt.location_name}
                </span>
              ) : null}
              {openAppt.patient_phone ? (
                <a
                  href={`tel:${openAppt.patient_phone.replace(/\D/g, "")}`}
                  className="inline-flex items-center gap-1.5 px-1 py-1.5 text-[13px] text-ink-400 hover:text-brand-700"
                >
                  <Phone className="size-4" /> {openAppt.patient_phone}
                </a>
              ) : null}
            </div>

            <div className="border-t border-line pt-4">
              <AppointmentActions
                appointmentId={openAppt.id}
                status={openAppt.status}
                hasInvoice={Boolean(openAppt.invoice_id)}
                closeHref={baseHref}
              />
            </div>

            <details className="group border-t border-line pt-4">
              <summary className="cursor-pointer list-none text-[13px] font-medium text-brand-700">
                <span className="group-open:hidden">Reschedule or change treatment</span>
                <span className="hidden group-open:inline">Hide reschedule</span>
              </summary>
              <div className="mt-3">
                <BookingForm
                  practitioners={practitioners}
                  treatments={treatments}
                  appointmentId={openAppt.id}
                  patient={{
                    id: openAppt.patient_id,
                    name: openAppt.patient_name,
                    email: "",
                    phone: openAppt.patient_phone,
                    dob: "",
                  }}
                  closeHref={baseHref}
                  defaults={{
                    date: openAppt.starts_at.slice(0, 10),
                    time: openAppt.starts_at.slice(11, 16),
                    practitionerId: openAppt.practitioner_id,
                    treatmentId: openAppt.treatment_id,
                    notes: openAppt.notes,
                  }}
                />
              </div>
            </details>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
