"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertCircle, Ban, Check, LogIn, Receipt, Trash2, UserX } from "lucide-react";
import { deleteAppointment, invoiceAppointment, setAppointmentStatus } from "@/lib/actions";
import { Button, buttonClass } from "@/components/ui";
import type { AppointmentStatus } from "@/lib/types";

export function AppointmentActions({
  appointmentId,
  status,
  hasInvoice,
  closeHref,
}: {
  appointmentId: number;
  status: AppointmentStatus;
  hasInvoice: boolean;
  closeHref: string;
}) {
  const [state, submit, pending] = useActionState(setAppointmentStatus, null);
  const [invState, invSubmit, invPending] = useActionState(invoiceAppointment, null);
  const [delState, delSubmit, delPending] = useActionState(deleteAppointment, null);
  const router = useRouter();

  const error =
    (state && !state.ok && state.error) ||
    (invState && !invState.ok && invState.error) ||
    (delState && !delState.ok && delState.error);

  const busy = pending || invPending || delPending;

  const StatusButton = ({
    to,
    icon,
    label,
    variant = "secondary",
  }: {
    to: AppointmentStatus;
    icon: React.ReactNode;
    label: string;
    variant?: "secondary" | "primary" | "danger";
  }) => (
    <form action={submit} className="contents">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="status" value={to} />
      <button type="submit" disabled={busy} className={buttonClass(variant, "sm")}>
        {icon}
        {label}
      </button>
    </form>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "booked" ? (
          <StatusButton to="arrived" icon={<LogIn className="size-4" />} label="Check in" variant="primary" />
        ) : null}
        {status === "arrived" || status === "booked" ? (
          <StatusButton
            to="completed"
            icon={<Check className="size-4" />}
            label="Check out"
            variant={status === "arrived" ? "primary" : "secondary"}
          />
        ) : null}
        {status !== "cancelled" && status !== "completed" ? (
          <>
            <StatusButton to="no_show" icon={<UserX className="size-4" />} label="No show" />
            <StatusButton to="cancelled" icon={<Ban className="size-4" />} label="Cancel" variant="danger" />
          </>
        ) : null}
        {status === "cancelled" || status === "no_show" ? (
          <StatusButton to="booked" icon={<Check className="size-4" />} label="Reinstate" />
        ) : null}

        {status === "completed" && !hasInvoice ? (
          <form action={invSubmit} className="contents">
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <button type="submit" disabled={busy} className={buttonClass("secondary", "sm")}>
              <Receipt className="size-4" />
              Create invoice
            </button>
          </form>
        ) : null}

        {!hasInvoice ? (
          <form action={delSubmit} className="contents">
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <button
              type="submit"
              disabled={busy}
              className={clsx(buttonClass("ghost", "sm"), "text-ink-400 hover:text-rose-700")}
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          </form>
        ) : null}

        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => router.push(closeHref)}>
          Close
        </Button>
      </div>

      {error ? (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
