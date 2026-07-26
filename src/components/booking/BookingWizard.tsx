"use client";

import { useActionState, useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";
import { bookOnline } from "@/lib/actions";
import { Avatar } from "@/components/ui";
import { colorSet } from "@/lib/colors";
import { duration, fmtDateLong, fmtTime, money } from "@/lib/format";
import type { DayOffer } from "@/lib/availability";

interface Clinic {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  cancellationHours: number;
}
interface Loc { id: number; name: string; address: string }
interface Disc { id: number; name: string; description: string; color: string }
interface Treat {
  id: number;
  name: string;
  disciplineId: number;
  durationMin: number;
  priceCents: number;
  description: string;
}
interface Prac {
  id: number;
  name: string;
  credentials: string;
  bio: string;
  color: string;
  disciplineId: number;
  locationId: number | null;
  treatmentIds: number[];
}

const STEPS = ["Service", "Practitioner", "Time", "Your details"] as const;

export function BookingWizard({
  clinic,
  locations,
  disciplines,
  treatments,
  practitioners,
  availability,
}: {
  clinic: Clinic;
  locations: Loc[];
  disciplines: Disc[];
  treatments: Treat[];
  practitioners: Prac[];
  availability: Record<string, DayOffer[]>;
}) {
  const [step, setStep] = useState(0);
  const [disciplineId, setDisciplineId] = useState<number | null>(null);
  const [treatmentId, setTreatmentId] = useState<number | null>(null);
  const [practitionerId, setPractitionerId] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const [state, submit, pending] = useActionState(bookOnline, null);

  const treatment = treatments.find((t) => t.id === treatmentId) ?? null;
  const practitioner = practitioners.find((p) => p.id === practitionerId) ?? null;

  const eligible = useMemo(
    () =>
      treatmentId
        ? practitioners.filter((p) => p.treatmentIds.includes(treatmentId))
        : [],
    [practitioners, treatmentId],
  );

  const offers: DayOffer[] =
    practitionerId && treatmentId ? (availability[`${practitionerId}:${treatmentId}`] ?? []) : [];

  if (state?.ok) {
    return (
      <Shell clinic={clinic}>
        <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand-100">
            <CalendarCheck className="size-7 text-brand-700" />
          </span>
          <h2 className="text-[20px] font-semibold tracking-tight text-ink-900">
            You&apos;re booked in
          </h2>
          <p className="mt-2 text-[14px] text-ink-500">
            {treatment?.name} with {practitioner?.name}
            <br />
            {date ? fmtDateLong(date) : ""} at {time ? fmtTime(time) : ""}
          </p>
          <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-[13px] text-ink-500">
            A confirmation is on its way to your inbox. Please give us at least{" "}
            {clinic.cancellationHours} hours&apos; notice if you need to change or cancel — call{" "}
            <a href={`tel:${clinic.phone.replace(/\D/g, "")}`} className="font-medium text-brand-700">
              {clinic.phone}
            </a>
            .
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 text-[13.5px] font-medium text-brand-700 hover:underline"
          >
            Book another appointment
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell clinic={clinic}>
      {/* ------------------------------------------------------ stepper */}
      <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={clsx(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors",
                i === step
                  ? "bg-brand-600 text-white"
                  : i < step
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-300",
              )}
            >
              {i < step ? <Check className="size-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
              {label}
            </span>
            {i < STEPS.length - 1 ? <ChevronRight className="size-3.5 text-ink-300" /> : null}
          </li>
        ))}
      </ol>

      {step > 0 ? (
        <button
          onClick={() => setStep((s) => s - 1)}
          className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-ink-400 hover:text-brand-700"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>
      ) : null}

      {/* ------------------------------------------------- 1. service */}
      {step === 0 ? (
        <div className="space-y-5">
          {disciplines.map((d) => {
            const items = treatments.filter((t) => t.disciplineId === d.id);
            if (!items.length) return null;
            const open = disciplineId === null || disciplineId === d.id;
            return (
              <section key={d.id} className="rounded-2xl border border-line bg-surface shadow-card">
                <button
                  onClick={() => setDisciplineId(disciplineId === d.id ? null : d.id)}
                  className="flex w-full items-center gap-3 p-5 text-left"
                >
                  <span className={clsx("size-3 rounded-full", colorSet(d.color).bar)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold text-ink-900">{d.name}</span>
                    <span className="block text-[13px] text-ink-400">{d.description}</span>
                  </span>
                  <span className="shrink-0 text-[12.5px] text-ink-300">
                    {items.length} services
                  </span>
                </button>
                {open ? (
                  <ul className="divide-y divide-line-soft border-t border-line">
                    {items.map((t) => (
                      <li key={t.id}>
                        <button
                          onClick={() => {
                            setTreatmentId(t.id);
                            setPractitionerId(null);
                            setDate(null);
                            setTime(null);
                            setStep(1);
                          }}
                          className="flex w-full items-start gap-4 px-5 py-3.5 text-left transition-colors hover:bg-brand-50/50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-medium text-ink-900">
                              {t.name}
                            </span>
                            {t.description ? (
                              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-400">
                                {t.description}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-[14px] font-semibold text-ink-900 tabular-nums">
                              {money(t.priceCents)}
                            </span>
                            <span className="block text-[12px] text-ink-400">
                              {duration(t.durationMin)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}

      {/* -------------------------------------------- 2. practitioner */}
      {step === 1 ? (
        <div className="space-y-3">
          <Summary treatment={treatment} />
          {eligible.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-6 text-center text-[13.5px] text-ink-400">
              Nobody is currently accepting online bookings for this service. Please call{" "}
              {clinic.phone}.
            </p>
          ) : (
            eligible.map((p) => {
              const loc = locations.find((l) => l.id === p.locationId);
              const days = availability[`${p.id}:${treatmentId}`] ?? [];
              const next = days[0];
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setPractitionerId(p.id);
                    setDate(days[0]?.date ?? null);
                    setTime(null);
                    setStep(2);
                  }}
                  className="flex w-full items-start gap-4 rounded-2xl border border-line bg-surface p-5 text-left shadow-card transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <Avatar name={p.name} color={p.color} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink-900">{p.name}</span>
                    <span className="block text-[12.5px] text-ink-400">{p.credentials}</span>
                    {p.bio ? (
                      <span className="mt-1.5 block text-[12.5px] leading-relaxed text-ink-500">
                        {p.bio}
                      </span>
                    ) : null}
                    {loc ? (
                      <span className="mt-1.5 flex items-center gap-1 text-[12px] text-ink-400">
                        <MapPin className="size-3.5" />
                        {loc.name}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    {next ? (
                      <>
                        <span className="block text-[11.5px] text-ink-400">Next available</span>
                        <span className="block text-[13px] font-medium text-brand-700">
                          {fmtDateLong(next.date).split(",")[0]}
                        </span>
                        <span className="block text-[12px] text-ink-400">
                          {fmtTime(next.slots[0])}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-ink-300">No openings</span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}

      {/* ---------------------------------------------------- 3. time */}
      {step === 2 ? (
        <div className="space-y-4">
          <Summary treatment={treatment} practitioner={practitioner} />
          {offers.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-6 text-center text-[13.5px] text-ink-400">
              No openings in the next three weeks. Please call {clinic.phone} and we&apos;ll find
              something.
            </p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1 thin-scroll">
                {offers.map((o) => (
                  <button
                    key={o.date}
                    onClick={() => {
                      setDate(o.date);
                      setTime(null);
                    }}
                    className={clsx(
                      "shrink-0 rounded-xl border px-4 py-2.5 text-center transition-colors",
                      date === o.date
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-line bg-surface text-ink-700 hover:border-brand-300",
                    )}
                  >
                    <span className="block text-[11.5px] opacity-80">
                      {fmtDateLong(o.date).split(",")[0].slice(0, 3)}
                    </span>
                    <span className="block text-[15px] font-semibold tabular-nums">
                      {Number(o.date.slice(8, 10))}
                    </span>
                    <span className="block text-[11px] opacity-70">{o.slots.length} open</span>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <p className="mb-3 text-[13.5px] font-medium text-ink-900">
                  {date ? fmtDateLong(date) : "Pick a day"}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {(offers.find((o) => o.date === date)?.slots ?? []).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setTime(s);
                        setStep(3);
                      }}
                      className={clsx(
                        "rounded-lg border px-2 py-2 text-[13px] font-medium tabular-nums transition-colors",
                        time === s
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-line text-ink-700 hover:border-brand-400 hover:bg-brand-50",
                      )}
                    >
                      {fmtTime(s)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* ------------------------------------------------- 4. details */}
      {step === 3 && treatment && practitioner && date && time ? (
        <form action={submit} className="space-y-4">
          <input type="hidden" name="treatmentId" value={treatment.id} />
          <input type="hidden" name="practitionerId" value={practitioner.id} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="time" value={time} />

          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
            <p className="text-[15px] font-semibold text-brand-900">{treatment.name}</p>
            <p className="mt-1 text-[13.5px] text-brand-800">
              {practitioner.name}
              {practitioner.credentials ? `, ${practitioner.credentials}` : ""}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-brand-800">
              <span className="flex items-center gap-1.5">
                <CalendarCheck className="size-4" />
                {fmtDateLong(date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" />
                {fmtTime(time)} · {duration(treatment.durationMin)}
              </span>
              <span className="font-semibold tabular-nums">{money(treatment.priceCents)}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h2 className="mb-4 text-[15px] font-semibold text-ink-900">Your details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-medium text-ink-500">First name</span>
                <input name="first_name" required className={FIELD} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-medium text-ink-500">Last name</span>
                <input name="last_name" required className={FIELD} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-medium text-ink-500">Email</span>
                <input type="email" name="email" required className={FIELD} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-medium text-ink-500">Phone</span>
                <input name="phone" className={FIELD} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[12.5px] font-medium text-ink-500">
                  Anything we should know?
                </span>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="What brings you in, injuries, or anything that would help us prepare."
                  className={FIELD}
                />
              </label>
            </div>

            <p className="mt-4 text-[12px] leading-relaxed text-ink-400">
              By booking you agree to our {clinic.cancellationHours}-hour cancellation policy. If you
              already have a file with us we&apos;ll match it by email.
            </p>

            {state && !state.ok ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-5 w-full rounded-xl bg-brand-600 px-5 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-300"
            >
              {pending ? "Confirming…" : "Confirm booking"}
            </button>
          </div>
        </form>
      ) : null}
    </Shell>
  );
}

const FIELD =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink-900 " +
  "placeholder:text-ink-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none";

function Summary({
  treatment,
  practitioner,
}: {
  treatment: Treat | null;
  practitioner?: Prac | null;
}) {
  if (!treatment) return null;
  return (
    <p className="rounded-xl border border-line bg-canvas px-4 py-2.5 text-[13px] text-ink-500">
      <span className="font-medium text-ink-900">{treatment.name}</span>
      <span className="mx-2 text-ink-300">·</span>
      {duration(treatment.durationMin)}
      <span className="mx-2 text-ink-300">·</span>
      {money(treatment.priceCents)}
      {practitioner ? (
        <>
          <span className="mx-2 text-ink-300">·</span>
          {practitioner.name}
        </>
      ) : null}
    </p>
  );
}

function Shell({ clinic, children }: { clinic: Clinic; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-5">
          {/* The public page is on a light background, so it can carry the full
              lockup — wordmark and all. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="ClinicMaxx — Allied Health Practice Management"
            width={260}
            height={67}
            className="h-auto w-[220px] shrink-0 sm:w-[260px]"
          />
          <div className="hidden border-l border-line pl-4 md:block">
            <p className="text-[14px] leading-tight font-semibold text-ink-900">{clinic.name}</p>
            <p className="text-[12.5px] text-ink-400">{clinic.tagline}</p>
          </div>
          <a
            href={`tel:${clinic.phone.replace(/\D/g, "")}`}
            className="ml-auto hidden text-[13px] font-medium text-brand-700 hover:underline sm:block"
          >
            {clinic.phone}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="mb-1 text-[24px] font-semibold tracking-tight text-ink-900">
          Book an appointment
        </h1>
        <p className="mb-6 text-[14px] text-ink-400">
          Pick a service, choose who you&apos;d like to see, and grab a time.
        </p>
        {children}
      </main>

      <footer className="border-t border-line py-6 text-center text-[12.5px] text-ink-300">
        Powered by ClinicMaxx
      </footer>
    </div>
  );
}
