"use client";

import { useActionState, useRef } from "react";
import { saveTask } from "@/lib/actions";
import { Button, Field, inputClass, selectClass } from "@/components/ui";
import { todayKey } from "@/lib/format";
import type { PractitionerView } from "@/lib/types";

export function TaskForm({
  practitioners,
  patientId,
}: {
  practitioners: PractitionerView[];
  patientId?: number;
}) {
  const [state, submit, pending] = useActionState(saveTask, null);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await submit(fd);
        ref.current?.reset();
      }}
      className="space-y-3"
    >
      {patientId ? <input type="hidden" name="patientId" value={patientId} /> : null}
      <Field label="Task">
        <input
          name="title"
          required
          placeholder="Call to rebook after no-show"
          className={inputClass}
        />
      </Field>
      <Field label="Detail">
        <textarea name="detail" rows={2} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due">
          <input type="date" name="due_on" defaultValue={todayKey()} className={inputClass} />
        </Field>
        <Field label="Assign to">
          <select name="assignee_id" className={selectClass}>
            <option value="">Anyone</option>
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-ink-400">
          {state?.ok ? state.message : state && !state.ok ? state.error : ""}
        </span>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add task"}
        </Button>
      </div>
    </form>
  );
}
