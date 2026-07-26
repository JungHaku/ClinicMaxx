import Link from "next/link";
import clsx from "clsx";
import { FileWarning, Globe, Repeat } from "lucide-react";
import { colorSet } from "@/lib/colors";
import { fmtTime, minutesOf, todayKey } from "@/lib/format";
import type { AppointmentView, PractitionerView } from "@/lib/types";

export const PX_PER_MIN = 1.4;
const SLOT_MIN = 15;

export interface Column {
  key: string;
  /** Heading shown above the column. */
  title: string;
  subtitle?: string;
  color: string;
  /** Query string appended when clicking an empty slot. */
  bookParams: Record<string, string>;
  /** Working hours for this column, as minute ranges. */
  shifts: Array<{ start: number; end: number }>;
  appointments: AppointmentView[];
}

/**
 * The calendar surface. Columns are practitioners in day view and days of the
 * week in week view — the geometry is identical either way.
 */
export function DayGrid({
  columns,
  windowStart,
  windowEnd,
  baseHref,
  date,
  showNowLine,
}: {
  columns: Column[];
  windowStart: number;
  windowEnd: number;
  baseHref: string;
  date: string;
  showNowLine: boolean;
}) {
  const height = (windowEnd - windowStart) * PX_PER_MIN;
  const hours: number[] = [];
  for (let m = Math.floor(windowStart / 60) * 60; m <= windowEnd; m += 60) hours.push(m);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowVisible = showNowLine && nowMin >= windowStart && nowMin <= windowEnd;

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card thin-scroll">
      <div className="min-w-max">
        {/* -------------------------------------------------- headings */}
        <div className="sticky top-0 z-10 flex border-b border-line bg-surface/95 backdrop-blur">
          <div className="w-14 shrink-0" />
          {columns.map((c) => (
            <div
              key={c.key}
              className="flex min-w-[168px] flex-1 items-center gap-2 border-l border-line-soft px-3 py-2.5"
            >
              <span className={clsx("size-2.5 shrink-0 rounded-full", colorSet(c.color).bar)} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-[13px] leading-tight font-semibold text-ink-900">
                  {c.title}
                </span>
                {c.subtitle ? (
                  <span className="block truncate text-[11.5px] text-ink-400">{c.subtitle}</span>
                ) : null}
              </span>
              <span className="ml-auto shrink-0 rounded-full bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-ink-400 tabular-nums">
                {c.appointments.filter((a) => a.status !== "cancelled").length}
              </span>
            </div>
          ))}
        </div>

        {/* ----------------------------------------------------- body */}
        <div className="relative flex" style={{ height }}>
          {/* hour gutter */}
          <div className="relative w-14 shrink-0">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-ink-300 tabular-nums"
                style={{ top: (h - windowStart) * PX_PER_MIN }}
              >
                {fmtTime(h).replace(":00", "")}
              </div>
            ))}
          </div>

          {columns.map((c) => (
            <div key={c.key} className="relative min-w-[168px] flex-1 border-l border-line-soft">
              {/* off-hours shading */}
              <div className="absolute inset-0 bg-canvas/60" />
              {c.shifts.map((s, i) => (
                <div
                  key={i}
                  className="absolute right-0 left-0 bg-white"
                  style={{
                    top: (Math.max(s.start, windowStart) - windowStart) * PX_PER_MIN,
                    height: (Math.min(s.end, windowEnd) - Math.max(s.start, windowStart)) * PX_PER_MIN,
                  }}
                />
              ))}

              {/* hour rules */}
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-0 left-0 border-t border-line-soft"
                  style={{ top: (h - windowStart) * PX_PER_MIN }}
                />
              ))}

              {/* clickable empty slots */}
              {Array.from(
                { length: Math.ceil((windowEnd - windowStart) / SLOT_MIN) },
                (_, i) => windowStart + i * SLOT_MIN,
              ).map((m) => {
                const inShift = c.shifts.some((s) => m >= s.start && m < s.end);
                const hh = String(Math.floor(m / 60)).padStart(2, "0");
                const mm = String(m % 60).padStart(2, "0");
                // Overwrite rather than append, so a week-view column's own date
                // wins over the anchor date already in the base query string.
                const q = new URLSearchParams(baseHref.split("?")[1] ?? "");
                for (const [k, v] of Object.entries(c.bookParams)) q.set(k, v);
                q.set("book", "1");
                q.set("time", `${hh}:${mm}`);
                return (
                  <Link
                    key={m}
                    href={`${baseHref.split("?")[0]}?${q.toString()}`}
                    className={clsx(
                      "group absolute right-0 left-0 z-0",
                      inShift ? "hover:bg-brand-50" : "hover:bg-canvas",
                    )}
                    style={{ top: (m - windowStart) * PX_PER_MIN, height: SLOT_MIN * PX_PER_MIN }}
                    aria-label={`Book at ${fmtTime(m)}`}
                  >
                    <span className="pointer-events-none absolute inset-0.5 hidden items-center justify-center rounded border border-dashed border-brand-300 text-[11px] font-medium text-brand-600 group-hover:flex">
                      + {fmtTime(m)}
                    </span>
                  </Link>
                );
              })}

              {/* appointments */}
              {layout(c.appointments).map(({ appt, lane, lanes }) => (
                <AppointmentBlock
                  key={appt.id}
                  appt={appt}
                  windowStart={windowStart}
                  lane={lane}
                  lanes={lanes}
                  href={`${baseHref}&appt=${appt.id}`}
                />
              ))}
            </div>
          ))}

          {nowVisible ? (
            <div
              className="pointer-events-none absolute right-0 left-14 z-20"
              style={{ top: (nowMin - windowStart) * PX_PER_MIN }}
            >
              <div className="relative border-t-2 border-rose-500/70">
                <span className="absolute -top-1.5 -left-1 size-2.5 rounded-full bg-rose-500" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

/** Side-by-side placement for overlapping appointments in one column. */
function layout(appts: AppointmentView[]) {
  const sorted = [...appts].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const placed: Array<{ appt: AppointmentView; lane: number; lanes: number }> = [];
  let cluster: typeof placed = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = cluster.reduce((m, c) => Math.max(m, c.lane + 1), 1);
    for (const c of cluster) c.lanes = lanes;
    placed.push(...cluster);
    cluster = [];
    clusterEnd = -1;
  };

  for (const appt of sorted) {
    const start = minutesOf(appt.starts_at);
    const end = minutesOf(appt.ends_at);
    if (start >= clusterEnd && cluster.length) flush();

    const taken = new Set(
      cluster.filter((c) => minutesOf(c.appt.ends_at) > start).map((c) => c.lane),
    );
    let lane = 0;
    while (taken.has(lane)) lane += 1;

    cluster.push({ appt, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) flush();
  return placed;
}

function AppointmentBlock({
  appt,
  windowStart,
  lane,
  lanes,
  href,
}: {
  appt: AppointmentView;
  windowStart: number;
  lane: number;
  lanes: number;
  href: string;
}) {
  const start = minutesOf(appt.starts_at);
  const end = minutesOf(appt.ends_at);
  const top = (start - windowStart) * PX_PER_MIN;
  const height = Math.max((end - start) * PX_PER_MIN, 20);
  const c = colorSet(appt.practitioner_color);
  const cancelled = appt.status === "cancelled";
  const tight = height < 38;

  return (
    <Link
      href={href}
      className={clsx(
        "absolute z-10 flex flex-col overflow-hidden rounded-md border px-1.5 py-1 transition-colors",
        cancelled
          ? "border-line bg-white/70 text-ink-300 line-through decoration-1"
          : c.block,
        appt.status === "no_show" && "border-rose-300 bg-rose-50 text-rose-900 no-underline",
      )}
      style={{
        top: top + 1,
        height: height - 2,
        left: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
      }}
      title={`${fmtTime(appt.starts_at)} · ${appt.patient_name} · ${appt.treatment_name}`}
    >
      <span className="flex items-center gap-1 text-[11.5px] leading-tight font-semibold">
        <span className="truncate">{appt.patient_name}</span>
        {appt.source === "online" ? (
          <Globe className="size-3 shrink-0 opacity-60" aria-label="Booked online" />
        ) : null}
        {appt.is_first_visit ? (
          <Repeat className="size-3 shrink-0 opacity-60" aria-label="First visit" />
        ) : null}
      </span>
      {!tight ? (
        <>
          <span className="truncate text-[11px] leading-tight opacity-80">
            {fmtTime(appt.starts_at)} · {appt.treatment_name}
          </span>
          <span className="mt-auto flex items-center gap-1 text-[10.5px] opacity-70">
            {appt.status !== "booked" ? (
              <span className="capitalize">{appt.status.replace("_", " ")}</span>
            ) : null}
            {appt.status === "completed" && !appt.has_note ? (
              <FileWarning className="size-3 text-amber-600" aria-label="Chart note missing" />
            ) : null}
          </span>
        </>
      ) : null}
    </Link>
  );
}

/** Convenience: is this date today? Used to decide whether to draw the now-line. */
export function isToday(date: string) {
  return date === todayKey();
}
