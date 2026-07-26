"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { createPatient, updatePatient } from "@/lib/actions";
import { Button, Card, CardHeader, Field, inputClass } from "@/components/ui";
import type { Patient } from "@/lib/types";

const REFERRALS = [
  "Google search", "Family doctor", "Word of mouth", "Instagram", "Returning client",
  "Walk-in", "Corporate benefits plan", "Insurance referral", "Other",
];

export function PatientForm({
  patient,
  defaultName,
}: {
  patient?: Patient;
  defaultName?: string;
}) {
  const [state, submit, pending] = useActionState(
    patient ? updatePatient : createPatient,
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && !patient && state.id) router.push(`/patients/${state.id}`);
  }, [state, patient, router]);

  const [first = "", last = ""] = (defaultName ?? "").split(" ");

  return (
    <form action={submit} className="space-y-4">
      {patient ? <input type="hidden" name="patientId" value={patient.id} /> : null}

      <Card>
        <CardHeader title="Who they are" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="First name">
            <input
              name="first_name"
              required
              defaultValue={patient?.first_name ?? first}
              className={inputClass}
            />
          </Field>
          <Field label="Last name">
            <input
              name="last_name"
              required
              defaultValue={patient?.last_name ?? last}
              className={inputClass}
            />
          </Field>
          <Field label="Preferred name" hint="What you'll call them in the waiting room.">
            <input name="preferred_name" defaultValue={patient?.preferred_name} className={inputClass} />
          </Field>
          <Field label="Pronouns">
            <input
              name="pronouns"
              placeholder="she/her"
              defaultValue={patient?.pronouns}
              className={inputClass}
            />
          </Field>
          <Field label="Date of birth">
            <input
              type="date"
              name="date_of_birth"
              defaultValue={patient?.date_of_birth}
              className={inputClass}
            />
          </Field>
          <Field label="Occupation">
            <input name="occupation" defaultValue={patient?.occupation} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="How to reach them" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <input type="email" name="email" defaultValue={patient?.email} className={inputClass} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={patient?.phone} className={inputClass} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <input name="address" defaultValue={patient?.address} className={inputClass} />
          </Field>
          <Field label="City">
            <input name="city" defaultValue={patient?.city} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Province">
              <input name="region" defaultValue={patient?.region} className={inputClass} />
            </Field>
            <Field label="Postal code">
              <input name="postal_code" defaultValue={patient?.postal_code} className={inputClass} />
            </Field>
          </div>
          <Field label="Emergency contact">
            <input name="emergency_name" defaultValue={patient?.emergency_name} className={inputClass} />
          </Field>
          <Field label="Emergency phone">
            <input name="emergency_phone" defaultValue={patient?.emergency_phone} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Clinical admin" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Family doctor">
            <input name="family_doctor" defaultValue={patient?.family_doctor} className={inputClass} />
          </Field>
          <Field label="How did they find us?">
            <input
              name="referral_source"
              list="referral-sources"
              defaultValue={patient?.referral_source}
              className={inputClass}
            />
            <datalist id="referral-sources">
              {REFERRALS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <Field
            label="Chart alert"
            hint="Shown as a banner everywhere this client appears."
            className="sm:col-span-2"
          >
            <input
              name="alert"
              placeholder="Latex allergy — use nitrile gloves."
              defaultValue={patient?.alert}
              className={inputClass}
            />
          </Field>
          <Field label="Tags" hint="Comma separated — MVA, WCB, Direct bill…" className="sm:col-span-2">
            <input name="tags" defaultValue={patient?.tags} className={inputClass} />
          </Field>
          <Field label="Internal notes" className="sm:col-span-2">
            <textarea name="notes" rows={3} defaultValue={patient?.notes} className={inputClass} />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-line-soft pt-4">
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input
              type="checkbox"
              name="intake_completed"
              defaultChecked={Boolean(patient?.intake_completed)}
              className="size-4 rounded border-line text-brand-600 focus:ring-brand-300"
            />
            Intake form completed
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input
              type="checkbox"
              name="consent_signed"
              defaultChecked={Boolean(patient?.consent_signed)}
              className="size-4 rounded border-line text-brand-600 focus:ring-brand-300"
            />
            Consent to treat signed
          </label>
        </div>
      </Card>

      {state && !state.ok ? (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}
      {state?.ok && patient ? (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
          <Check className="size-4" />
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : patient ? "Save changes" : "Create client"}
        </Button>
      </div>
    </form>
  );
}
