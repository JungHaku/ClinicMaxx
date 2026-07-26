"use client";

import { useActionState, useState } from "react";
import { Archive } from "lucide-react";
import { archivePatient } from "@/lib/actions";
import { Button, buttonClass } from "@/components/ui";

export function ArchivePatientButton({ patientId }: { patientId: number }) {
  const [, submit, pending] = useActionState(archivePatient, null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        <Archive className="size-4" />
        Archive
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1">
      <span className="text-[12.5px] text-rose-800">Hide from the client list?</span>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        No
      </Button>
      <form action={submit}>
        <input type="hidden" name="patientId" value={patientId} />
        <button type="submit" disabled={pending} className={buttonClass("danger", "sm")}>
          {pending ? "Archiving…" : "Archive"}
        </button>
      </form>
    </div>
  );
}
