"use client";

import { useActionState, useRef } from "react";
import { Send } from "lucide-react";
import { logCommunication } from "@/lib/actions";
import { Button, inputClass, selectClass } from "@/components/ui";

export function CommunicationForm({ patientId }: { patientId: number }) {
  const [state, submit, pending] = useActionState(logCommunication, null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await submit(fd);
        formRef.current?.reset();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex gap-2">
        <select name="kind" defaultValue="note" className={`${selectClass} w-32 shrink-0`}>
          <option value="note">Note</option>
          <option value="call">Phone call</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
        <input name="subject" placeholder="Subject (optional)" className={inputClass} />
      </div>
      <textarea
        name="body"
        rows={2}
        required
        placeholder="What happened? Keep it factual — this becomes part of the client record."
        className={inputClass}
      />
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-ink-400">
          {state?.ok ? state.message : state && !state.ok ? state.error : ""}
        </span>
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          <Send className="size-3.5" />
          {pending ? "Logging…" : "Log entry"}
        </Button>
      </div>
    </form>
  );
}
