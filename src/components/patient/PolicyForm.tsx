"use client";

import { useActionState } from "react";
import { AlertCircle, Trash2 } from "lucide-react";
import { deletePolicy, savePolicy } from "@/lib/actions";
import { Button, Field, buttonClass, inputClass, selectClass } from "@/components/ui";
import type { InsurancePolicy } from "@/lib/types";

const INSURERS = [
  "Pacific Blue Cross", "Sun Life Financial", "Manulife", "Canada Life",
  "Green Shield Canada", "Desjardins Insurance", "Equitable Life", "ICBC", "WorkSafeBC",
];

export function PolicyForm({
  patientId,
  policy,
  onDone,
}: {
  patientId: number;
  policy?: InsurancePolicy;
  onDone?: () => void;
}) {
  const [state, submit, pending] = useActionState(savePolicy, null);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="patientId" value={patientId} />
      {policy ? <input type="hidden" name="policyId" value={policy.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Insurer">
          <input
            name="insurer_name"
            required
            list="insurers"
            defaultValue={policy?.insurer_name}
            className={inputClass}
          />
          <datalist id="insurers">
            {INSURERS.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
        </Field>
        <Field label="Plan type">
          <select name="plan_type" defaultValue={policy?.plan_type ?? "extended"} className={selectClass}>
            <option value="extended">Extended health</option>
            <option value="mva">Motor vehicle accident</option>
            <option value="wcb">Workers&apos; compensation</option>
            <option value="ihap">Government / MSP</option>
          </select>
        </Field>
        <Field label="Policy number">
          <input name="policy_number" defaultValue={policy?.policy_number} className={inputClass} />
        </Field>
        <Field label="Member ID">
          <input name="member_id" defaultValue={policy?.member_id} className={inputClass} />
        </Field>
        <Field label="Coverage %">
          <input
            type="number"
            name="coverage_percent"
            min={0}
            max={100}
            defaultValue={policy?.coverage_percent ?? 80}
            className={inputClass}
          />
        </Field>
        <Field label="Annual maximum" hint="Leave 0 for unlimited.">
          <input
            name="annual_max"
            defaultValue={policy ? (policy.annual_max_cents / 100).toFixed(2) : "500.00"}
            className={inputClass}
          />
        </Field>
        <Field label="Used this year">
          <input
            name="used"
            defaultValue={policy ? (policy.used_cents / 100).toFixed(2) : "0.00"}
            className={inputClass}
          />
        </Field>
        <Field label="Valid until">
          <input type="date" name="valid_to" defaultValue={policy?.valid_to} className={inputClass} />
        </Field>
        <Field label="Visits allowed" hint="0 = no visit cap.">
          <input
            type="number"
            name="visits_allowed"
            defaultValue={policy?.visits_allowed ?? 0}
            className={inputClass}
          />
        </Field>
        <Field label="Visits used">
          <input
            type="number"
            name="visits_used"
            defaultValue={policy?.visits_used ?? 0}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[13px] text-ink-700">
          <input
            type="checkbox"
            name="direct_billing"
            defaultChecked={policy ? Boolean(policy.direct_billing) : true}
            className="size-4 rounded border-line text-brand-600 focus:ring-brand-300"
          />
          We direct bill this plan
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink-700">
          <input
            type="checkbox"
            name="is_primary"
            defaultChecked={policy ? Boolean(policy.is_primary) : true}
            className="size-4 rounded border-line text-brand-600 focus:ring-brand-300"
          />
          Primary plan
        </label>
      </div>

      {state && !state.ok ? (
        <p className="flex items-start gap-2 text-[12.5px] text-rose-700">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {policy ? <DeletePolicyButton patientId={patientId} policyId={policy.id} /> : null}
        {onDone ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save policy"}
        </Button>
      </div>
    </form>
  );
}

function DeletePolicyButton({ patientId, policyId }: { patientId: number; policyId: number }) {
  const [, submit, pending] = useActionState(deletePolicy, null);
  return (
    <form action={submit}>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="policyId" value={policyId} />
      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass("ghost", "sm")} mr-auto text-ink-400 hover:text-rose-700`}
      >
        <Trash2 className="size-4" />
        Remove
      </button>
    </form>
  );
}
