"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Ban, Plus, Trash2 } from "lucide-react";
import {
  addInvoiceItem,
  recordPayment,
  removeInvoiceItem,
  submitClaim,
  voidInvoice,
} from "@/lib/actions";
import { Button, Field, buttonClass, inputClass, selectClass } from "@/components/ui";
import { money, todayKey } from "@/lib/format";
import type { InsurancePolicy, Product } from "@/lib/types";

/* ------------------------------------------------------- take payment */

export function PaymentForm({
  invoiceId,
  owingCents,
}: {
  invoiceId: number;
  owingCents: number;
}) {
  const [state, submit, pending] = useActionState(recordPayment, null);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount" hint={`${money(owingCents)} owing`}>
          <input
            name="amount"
            defaultValue={(owingCents / 100).toFixed(2)}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
        <Field label="Method">
          <select name="method" defaultValue="card" className={selectClass}>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="etransfer">e-Transfer</option>
            <option value="insurer">Insurer</option>
            <option value="credit">Account credit</option>
          </select>
        </Field>
        <Field label="Received on">
          <input type="date" name="received_on" defaultValue={todayKey()} className={inputClass} />
        </Field>
        <Field label="Reference">
          <input name="reference" placeholder="••••4242" className={inputClass} />
        </Field>
      </div>
      {state && !state.ok ? (
        <p className="flex items-start gap-2 text-[12.5px] text-rose-700">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" disabled={pending || owingCents <= 0}>
          {pending ? "Recording…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}

/* --------------------------------------------------------- line items */

export function AddItemForm({
  invoiceId,
  products,
}: {
  invoiceId: number;
  products: Product[];
}) {
  const [state, submit, pending] = useActionState(addInvoiceItem, null);
  const [productId, setProductId] = useState(0);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add line item
      </Button>
    );
  }

  const product = products.find((p) => p.id === productId);

  return (
    <form action={submit} className="space-y-3 rounded-lg border border-line bg-canvas p-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Retail product">
          <select
            name="productId"
            value={productId}
            onChange={(e) => setProductId(Number(e.target.value))}
            className={selectClass}
          >
            <option value={0}>— Custom item —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {money(p.price_cents)} ({p.stock} in stock)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kind">
          <select name="kind" defaultValue={productId ? "product" : "fee"} className={selectClass}>
            <option value="product">Product</option>
            <option value="fee">Fee</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </Field>
        <Field label="Description">
          <input
            name="description"
            defaultValue={product?.name ?? ""}
            key={productId}
            placeholder="Late cancellation fee"
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <input type="number" name="quantity" min={1} defaultValue={1} className={inputClass} />
          </Field>
          <Field label="Unit price">
            <input
              name="unit_price"
              key={`price-${productId}`}
              defaultValue={product ? (product.price_cents / 100).toFixed(2) : ""}
              inputMode="decimal"
              className={inputClass}
            />
          </Field>
        </div>
      </div>
      {state && !state.ok ? (
        <p className="text-[12.5px] text-rose-700">{state.error}</p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add item"}
        </Button>
      </div>
    </form>
  );
}

export function RemoveItemButton({ invoiceId, itemId }: { invoiceId: number; itemId: number }) {
  const [, submit, pending] = useActionState(removeInvoiceItem, null);
  return (
    <form action={submit}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        aria-label="Remove line item"
        className="rounded p-1 text-ink-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="size-3.5" />
      </button>
    </form>
  );
}

/* -------------------------------------------------------- submit claim */

export function SubmitClaimForm({
  invoiceId,
  policies,
  owingCents,
}: {
  invoiceId: number;
  policies: InsurancePolicy[];
  owingCents: number;
}) {
  const [state, submit, pending] = useActionState(submitClaim, null);

  if (!policies.length) {
    return (
      <p className="text-[12.5px] text-ink-400">
        No insurance on file for this client. Add a policy on their profile first.
      </p>
    );
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Policy">
          <select name="policyId" className={selectClass}>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.insurer_name} · {p.coverage_percent}%
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount to bill">
          <input
            name="amount"
            defaultValue={(owingCents / 100).toFixed(2)}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
      </div>
      {state && !state.ok ? (
        <p className="text-[12.5px] text-rose-700">{state.error}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Submitting…" : "Submit claim"}
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- void */

export function VoidInvoiceButton({ invoiceId }: { invoiceId: number }) {
  const [state, submit, pending] = useActionState(voidInvoice, null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        <Ban className="size-4" />
        Void
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12.5px] text-ink-500">Void this invoice?</span>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        No
      </Button>
      <form action={submit}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <button type="submit" disabled={pending} className={buttonClass("danger", "sm")}>
          {pending ? "Voiding…" : "Yes, void"}
        </button>
      </form>
      {state && !state.ok ? (
        <span className="w-full text-[12px] text-rose-600">{state.error}</span>
      ) : null}
    </div>
  );
}
