"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import {
  saveAvailability,
  saveClinic,
  saveLocation,
  savePractitioner,
  saveProduct,
  saveTreatment,
} from "@/lib/actions";
import { Button, Field, inputClass, selectClass } from "@/components/ui";
import { COLOR_NAMES } from "@/lib/colors";
import type {
  Availability,
  Clinic,
  Discipline,
  Location,
  Practitioner,
  Product,
  Treatment,
} from "@/lib/types";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Status({ state }: { state: { ok: boolean; message?: string; error?: string } | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="flex items-center gap-2 text-[12.5px] text-emerald-700">
      <Check className="size-3.5" />
      {state.message}
    </p>
  ) : (
    <p className="flex items-start gap-2 text-[12.5px] text-rose-700">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      {state.error}
    </p>
  );
}

/* --------------------------------------------------------------- clinic */

export function ClinicForm({ clinic }: { clinic: Clinic }) {
  const [state, submit, pending] = useActionState(saveClinic, null);

  return (
    <form action={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Clinic name">
          <input name="name" defaultValue={clinic.name} className={inputClass} required />
        </Field>
        <Field label="Tagline">
          <input name="tagline" defaultValue={clinic.tagline} className={inputClass} />
        </Field>
        <Field label="Email">
          <input type="email" name="email" defaultValue={clinic.email} className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={clinic.phone} className={inputClass} />
        </Field>
        <Field label="Website">
          <input name="website" defaultValue={clinic.website} className={inputClass} />
        </Field>
        <Field label="Timezone">
          <input name="timezone" defaultValue={clinic.timezone} className={inputClass} />
        </Field>
        <Field label="Invoice prefix" hint="Invoices number as PREFIX-1001, PREFIX-1002…">
          <input name="invoice_prefix" defaultValue={clinic.invoice_prefix} className={inputClass} />
        </Field>
        <Field label="Minimum booking notice" hint="Hours before a slot closes to online booking.">
          <input
            type="number"
            name="booking_lead_hours"
            defaultValue={clinic.booking_lead_hours}
            className={inputClass}
          />
        </Field>
        <Field label="Cancellation window" hint="Hours of notice before a fee applies.">
          <input
            type="number"
            name="cancellation_hours"
            defaultValue={clinic.cancellation_hours}
            className={inputClass}
          />
        </Field>
        <Field label="Late cancellation fee">
          <input
            name="cancellation_fee"
            defaultValue={(clinic.cancellation_fee_cents / 100).toFixed(2)}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        <Status state={state} />
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------ treatment */

export function TreatmentForm({
  treatment,
  disciplines,
  closeHref,
}: {
  treatment?: Treatment;
  disciplines: Discipline[];
  closeHref: string;
}) {
  const [state, submit, pending] = useActionState(saveTreatment, null);
  const router = useRouter();

  return (
    <form action={submit} className="space-y-4">
      {treatment ? <input type="hidden" name="treatmentId" value={treatment.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <input name="name" defaultValue={treatment?.name} className={inputClass} required />
        </Field>
        <Field label="Discipline">
          <select
            name="discipline_id"
            defaultValue={treatment?.discipline_id ?? disciplines[0]?.id}
            className={selectClass}
          >
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Duration (minutes)">
          <input
            type="number"
            name="duration_min"
            min={5}
            step={5}
            defaultValue={treatment?.duration_min ?? 30}
            className={inputClass}
          />
        </Field>
        <Field label="Price">
          <input
            name="price"
            defaultValue={treatment ? (treatment.price_cents / 100).toFixed(2) : "0.00"}
            className={inputClass}
          />
        </Field>
        <Field label="Tax (basis points)" hint="0 for tax-exempt health services; 1200 = 12%.">
          <input
            type="number"
            name="tax_bps"
            defaultValue={treatment?.tax_bps ?? 0}
            className={inputClass}
          />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea
            name="description"
            rows={2}
            defaultValue={treatment?.description}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[13px] text-ink-700">
          <input
            type="checkbox"
            name="online_bookable"
            defaultChecked={treatment ? Boolean(treatment.online_bookable) : true}
            className="size-4 rounded border-line text-brand-600 focus:ring-brand-300"
          />
          Bookable online
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink-700">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={treatment ? Boolean(treatment.is_active) : true}
            className="size-4 rounded border-line text-brand-600 focus:ring-brand-300"
          />
          Active
        </label>
      </div>
      <div className="flex items-center justify-end gap-3">
        <Status state={state} />
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push(closeHref)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save treatment"}
        </Button>
      </div>
    </form>
  );
}

/* --------------------------------------------------------- practitioner */

export function PractitionerForm({
  practitioner,
  disciplines,
  locations,
  availability,
  closeHref,
}: {
  practitioner?: Practitioner;
  disciplines: Discipline[];
  locations: Location[];
  availability?: Array<Pick<Availability, "weekday" | "start_min" | "end_min">>;
  closeHref: string;
}) {
  const [state, submit, pending] = useActionState(savePractitioner, null);
  const router = useRouter();

  return (
    <div className="space-y-6">
      <form action={submit} className="space-y-4">
        {practitioner ? (
          <input type="hidden" name="practitionerId" value={practitioner.id} />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name">
            <input
              name="first_name"
              defaultValue={practitioner?.first_name}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Last name">
            <input
              name="last_name"
              defaultValue={practitioner?.last_name}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Credentials" hint="Shown on chart notes and receipts.">
            <input
              name="credentials"
              placeholder="PT, MScPT"
              defaultValue={practitioner?.credentials}
              className={inputClass}
            />
          </Field>
          <Field label="Discipline">
            <select
              name="discipline_id"
              defaultValue={practitioner?.discipline_id ?? disciplines[0]?.id}
              className={selectClass}
            >
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Email">
            <input type="email" name="email" defaultValue={practitioner?.email} className={inputClass} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={practitioner?.phone} className={inputClass} />
          </Field>
          <Field label="Primary location">
            <select
              name="location_id"
              defaultValue={practitioner?.location_id ?? locations[0]?.id}
              className={selectClass}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Role">
            <select name="role" defaultValue={practitioner?.role ?? "practitioner"} className={selectClass}>
              <option value="practitioner">Practitioner</option>
              <option value="admin">Administrator</option>
              <option value="owner">Owner</option>
            </select>
          </Field>
          <Field label="Calendar colour" className="sm:col-span-2">
            <select name="color" defaultValue={practitioner?.color ?? "teal"} className={selectClass}>
              {COLOR_NAMES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bio" className="sm:col-span-2">
            <textarea name="bio" rows={3} defaultValue={practitioner?.bio} className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input
              type="checkbox"
              name="online_booking"
              defaultChecked={practitioner ? Boolean(practitioner.online_booking) : true}
              className="size-4 rounded border-line text-brand-600 focus:ring-brand-300"
            />
            Accepts online bookings
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={practitioner ? Boolean(practitioner.is_active) : true}
              className="size-4 rounded border-line text-brand-600 focus:ring-brand-300"
            />
            Active
          </label>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Status state={state} />
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(closeHref)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save practitioner"}
          </Button>
        </div>
      </form>

      {practitioner ? (
        <div className="border-t border-line pt-5">
          <AvailabilityForm
            practitionerId={practitioner.id}
            locationId={practitioner.location_id}
            locations={locations}
            availability={availability ?? []}
          />
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- availability */

function toTime(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function AvailabilityForm({
  practitionerId,
  locationId,
  locations,
  availability,
}: {
  practitionerId: number;
  locationId: number | null;
  locations: Location[];
  availability: Array<Pick<Availability, "weekday" | "start_min" | "end_min">>;
}) {
  const [state, submit, pending] = useActionState(saveAvailability, null);
  const byDay = new Map(availability.map((a) => [a.weekday, a]));

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="practitionerId" value={practitionerId} />
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-semibold text-ink-900">Working hours</h3>
        <p className="text-[12px] text-ink-400">Drives the calendar and online booking.</p>
      </div>

      <Field label="Location">
        <select name="location_id" defaultValue={locationId ?? locations[0]?.id} className={selectClass}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>

      <ul className="space-y-1.5">
        {DAY_LABELS.map((label, wd) => {
          const shift = byDay.get(wd);
          return (
            <li key={wd} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
              <label className="flex w-32 items-center gap-2 text-[13px] text-ink-700">
                <input
                  type="checkbox"
                  name={`on:${wd}`}
                  defaultChecked={Boolean(shift)}
                  className="size-4 rounded border-line text-brand-600 focus:ring-brand-300"
                />
                {label}
              </label>
              <input
                type="time"
                name={`start:${wd}`}
                step={900}
                defaultValue={shift ? toTime(shift.start_min) : "09:00"}
                className={`${inputClass} w-32 py-1`}
              />
              <span className="text-ink-300">–</span>
              <input
                type="time"
                name={`end:${wd}`}
                step={900}
                defaultValue={shift ? toTime(shift.end_min) : "17:00"}
                className={`${inputClass} w-32 py-1`}
              />
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-end gap-3">
        <Status state={state} />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save hours"}
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------- product */

export function ProductForm({ product, closeHref }: { product?: Product; closeHref: string }) {
  const [state, submit, pending] = useActionState(saveProduct, null);
  const router = useRouter();

  return (
    <form action={submit} className="space-y-4">
      {product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <input name="name" defaultValue={product?.name} className={inputClass} required />
        </Field>
        <Field label="SKU">
          <input name="sku" defaultValue={product?.sku} className={inputClass} />
        </Field>
        <Field label="Stock on hand">
          <input type="number" name="stock" defaultValue={product?.stock ?? 0} className={inputClass} />
        </Field>
        <Field label="Retail price">
          <input
            name="price"
            defaultValue={product ? (product.price_cents / 100).toFixed(2) : "0.00"}
            className={inputClass}
          />
        </Field>
        <Field label="Cost">
          <input
            name="cost"
            defaultValue={product ? (product.cost_cents / 100).toFixed(2) : "0.00"}
            className={inputClass}
          />
        </Field>
        <Field label="Tax (basis points)">
          <input
            type="number"
            name="tax_bps"
            defaultValue={product?.tax_bps ?? 1200}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        <Status state={state} />
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push(closeHref)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save product"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------- location */

export function LocationForm({ location, closeHref }: { location?: Location; closeHref: string }) {
  const [state, submit, pending] = useActionState(saveLocation, null);
  const router = useRouter();

  return (
    <form action={submit} className="space-y-4">
      {location ? <input type="hidden" name="locationId" value={location.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <input name="name" defaultValue={location?.name} className={inputClass} required />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <input name="address" defaultValue={location?.address} className={inputClass} />
        </Field>
        <Field label="City">
          <input name="city" defaultValue={location?.city} className={inputClass} />
        </Field>
        <Field label="Province">
          <input name="region" defaultValue={location?.region} className={inputClass} />
        </Field>
        <Field label="Postal code">
          <input name="postal_code" defaultValue={location?.postal_code} className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={location?.phone} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        <Status state={state} />
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push(closeHref)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save location"}
        </Button>
      </div>
    </form>
  );
}
