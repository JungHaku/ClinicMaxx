"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { bookAppointment, rescheduleAppointment } from "@/lib/actions";
import { Button, Field, inputClass, selectClass } from "@/components/ui";
import { PatientPicker, type PickedPatient } from "@/components/PatientPicker";
import { duration, money } from "@/lib/format";
import type { PractitionerView, Treatment } from "@/lib/types";

export interface BookingTreatment extends Treatment {
  practitionerIds: number[];
}

export function BookingForm({
  practitioners,
  treatments,
  defaults,
  patient,
  appointmentId,
  closeHref,
}: {
  practitioners: PractitionerView[];
  treatments: BookingTreatment[];
  defaults: { date: string; time: string; practitionerId?: number; treatmentId?: number; notes?: string };
  patient?: PickedPatient | null;
  appointmentId?: number;
  closeHref: string;
}) {
  const router = useRouter();
  const action = appointmentId ? rescheduleAppointment : bookAppointment;
  const [state, submit, pending] = useActionState(action, null);

  const [practitionerId, setPractitionerId] = useState(
    defaults.practitionerId ?? practitioners[0]?.id ?? 0,
  );
  const available = useMemo(
    () => treatments.filter((t) => t.practitionerIds.includes(practitionerId)),
    [treatments, practitionerId],
  );
  const [treatmentId, setTreatmentId] = useState(defaults.treatmentId ?? 0);

  // Keep the treatment valid whenever the practitioner changes.
  useEffect(() => {
    if (!available.some((t) => t.id === treatmentId)) {
      setTreatmentId(available[0]?.id ?? 0);
    }
  }, [available, treatmentId]);

  useEffect(() => {
    if (state?.ok) router.push(closeHref);
  }, [state, router, closeHref]);

  const treatment = available.find((t) => t.id === treatmentId);

  return (
    <form action={submit} className="space-y-4">
      {appointmentId ? <input type="hidden" name="appointmentId" value={appointmentId} /> : null}

      {!appointmentId ? (
        <Field label="Client">
          <PatientPicker initial={patient} autoFocus={!patient} />
        </Field>
      ) : (
        <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-[13.5px] text-ink-700">
          {patient?.name}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Practitioner">
          <select
            name="practitionerId"
            value={practitionerId}
            onChange={(e) => setPractitionerId(Number(e.target.value))}
            className={selectClass}
          >
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name} — {p.discipline}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Treatment">
          <select
            name="treatmentId"
            value={treatmentId}
            onChange={(e) => setTreatmentId(Number(e.target.value))}
            className={selectClass}
          >
            {available.length === 0 ? <option value="">No treatments configured</option> : null}
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.duration_min}m
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date">
          <input type="date" name="date" defaultValue={defaults.date} className={inputClass} required />
        </Field>

        <Field label="Start time">
          <input type="time" name="time" defaultValue={defaults.time} step={300} className={inputClass} required />
        </Field>
      </div>

      {treatment ? (
        <div className="flex items-center justify-between rounded-lg border border-brand-100 bg-brand-50/70 px-3 py-2 text-[12.5px] text-brand-800">
          <span>{duration(treatment.duration_min)} appointment</span>
          <span className="font-semibold tabular-nums">{money(treatment.price_cents)}</span>
        </div>
      ) : null}

      <Field label="Appointment note" hint="Visible to the practitioner on the schedule.">
        <textarea
          name="notes"
          rows={2}
          defaultValue={defaults.notes ?? ""}
          placeholder="Anything the practitioner should know before the visit…"
          className={inputClass}
        />
      </Field>

      {state && !state.ok ? (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={() => router.push(closeHref)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : appointmentId ? "Save changes" : "Book appointment"}
        </Button>
      </div>
    </form>
  );
}
