"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { addAddendum } from "@/lib/actions";
import { Button, inputClass } from "@/components/ui";

export function AddendumForm({ noteId }: { noteId: number }) {
  const [state, submit, pending] = useActionState(addAddendum, null);

  return (
    <details className="group mt-4 border-t border-line pt-4">
      <summary className="cursor-pointer list-none text-[13px] font-medium text-brand-700">
        <span className="group-open:hidden">Add an addendum</span>
        <span className="hidden group-open:inline">Cancel addendum</span>
      </summary>
      <form action={submit} className="mt-3 space-y-2">
        <input type="hidden" name="noteId" value={noteId} />
        <textarea
          name="addendum"
          rows={3}
          required
          placeholder="Correction, late entry, or additional detail. It will be timestamped and appended."
          className={inputClass}
        />
        {state && !state.ok ? (
          <p className="flex items-start gap-2 text-[12.5px] text-rose-700">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {state.error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            {pending ? "Adding…" : "Append addendum"}
          </Button>
        </div>
      </form>
    </details>
  );
}
