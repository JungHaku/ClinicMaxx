"use client";

import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { addDays, fmtDateLong, todayKey } from "@/lib/format";
import type { PractitionerView } from "@/lib/types";

export function ScheduleToolbar({
  date,
  view,
  practitioners,
  selected,
}: {
  date: string;
  view: "day" | "week";
  practitioners: PractitionerView[];
  selected: number[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function push(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("appt");
    next.delete("book");
    router.push(`/schedule?${next.toString()}`);
  }

  const step = view === "week" ? 7 : 1;
  const allSelected = selected.length === 0 || selected.length === practitioners.length;

  function togglePractitioner(id: number) {
    const current = new Set(selected.length ? selected : practitioners.map((p) => p.id));
    if (current.has(id)) current.delete(id);
    else current.add(id);
    if (current.size === 0 || current.size === practitioners.length) push({ prac: null });
    else push({ prac: [...current].join(",") });
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-line bg-surface shadow-card">
          <button
            onClick={() => push({ date: addDays(date, -step) })}
            className="flex size-9 items-center justify-center rounded-l-lg text-ink-500 transition-colors hover:bg-canvas hover:text-ink-900"
            aria-label="Previous"
          >
            <ChevronLeft className="size-4.5" />
          </button>
          <span className="w-px self-stretch bg-line" />
          <button
            onClick={() => push({ date: addDays(date, step) })}
            className="flex size-9 items-center justify-center rounded-r-lg text-ink-500 transition-colors hover:bg-canvas hover:text-ink-900"
            aria-label="Next"
          >
            <ChevronRight className="size-4.5" />
          </button>
        </div>

        <button onClick={() => push({ date: todayKey() })} className={buttonClass("secondary", "md")}>
          Today
        </button>

        <label className="relative">
          <span className="sr-only">Jump to date</span>
          <CalendarDays className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-300" />
          <input
            type="date"
            value={date}
            onChange={(e) => push({ date: e.target.value })}
            className="h-9.5 rounded-lg border border-line bg-surface pr-3 pl-8 text-[13.5px] text-ink-900 shadow-card focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
        </label>

        <h2 className="ml-1 hidden text-[15px] font-semibold text-ink-900 md:block">
          {view === "week"
            ? `Week of ${fmtDateLong(date).replace(/^\w+, /, "")}`
            : fmtDateLong(date)}
        </h2>

        <div className="ml-auto flex items-center rounded-lg border border-line bg-surface p-0.5 shadow-card">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => push({ view: v })}
              className={clsx(
                "rounded-md px-3 py-1.5 text-[13px] font-medium capitalize transition-colors",
                view === v ? "bg-brand-600 text-white" : "text-ink-500 hover:text-ink-900",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => push({ prac: null })}
          className={clsx(
            "rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
            allSelected
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-line bg-surface text-ink-500 hover:border-brand-300",
          )}
        >
          Everyone
        </button>
        {practitioners.map((p) => {
          const on = !allSelected && selected.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => togglePractitioner(p.id)}
              className={clsx(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                on
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-line bg-surface text-ink-500 hover:border-brand-300",
              )}
            >
              <span className={clsx("size-2 rounded-full", DOT[p.color] ?? DOT.teal)} aria-hidden />
              {p.first_name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const DOT: Record<string, string> = {
  teal: "bg-teal-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  violet: "bg-violet-500",
  indigo: "bg-indigo-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  slate: "bg-slate-400",
};
