"use client";

import { useActionState, useState } from "react";
import { settleClaim } from "@/lib/actions";
import { Button, buttonClass, inputClass } from "@/components/ui";
import { money } from "@/lib/format";

export function SettleClaimForm({
  claimId,
  approvedCents,
}: {
  claimId: number;
  approvedCents: number;
}) {
  const [state, submit, pending] = useActionState(settleClaim, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Settle
      </Button>
    );
  }

  return (
    <form action={submit} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="claimId" value={claimId} />
      <input
        name="amount"
        defaultValue={(approvedCents / 100).toFixed(2)}
        aria-label={`Remittance amount (approved ${money(approvedCents)})`}
        className={`${inputClass} w-24 py-1 text-right`}
      />
      <button
        type="submit"
        name="outcome"
        value="paid"
        disabled={pending}
        className={buttonClass("primary", "sm")}
      >
        Paid
      </button>
      <button
        type="submit"
        name="outcome"
        value="rejected"
        disabled={pending}
        className={buttonClass("danger", "sm")}
      >
        Reject
      </button>
      {state && !state.ok ? (
        <span className="w-full text-right text-[11.5px] text-rose-600">{state.error}</span>
      ) : null}
    </form>
  );
}
