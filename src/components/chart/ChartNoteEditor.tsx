"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertCircle, Lock, PenLine, Save } from "lucide-react";
import { saveChartNote } from "@/lib/actions";
import { Button, Field, inputClass, selectClass } from "@/components/ui";
import { todayKey } from "@/lib/format";
import type { ChartField, ChartNoteView, ChartTemplate, PractitionerView } from "@/lib/types";

export function ChartNoteEditor({
  patientId,
  practitioners,
  templates,
  note,
  appointmentId,
  defaultPractitionerId,
  closeHref,
}: {
  patientId: number;
  practitioners: PractitionerView[];
  templates: ChartTemplate[];
  note?: ChartNoteView;
  appointmentId?: number;
  defaultPractitionerId?: number;
  closeHref: string;
}) {
  const router = useRouter();
  const [state, submit, pending] = useActionState(saveChartNote, null);
  const [templateId, setTemplateId] = useState(
    note?.template_id ?? templates[0]?.id ?? 0,
  );

  const template = templates.find((t) => t.id === templateId);
  const fields: ChartField[] = useMemo(() => {
    if (!template) return [];
    try {
      return JSON.parse(template.fields_json) as ChartField[];
    } catch {
      return [];
    }
  }, [template]);

  const body: Record<string, string> = useMemo(() => {
    if (!note) return {};
    try {
      return JSON.parse(note.body_json) as Record<string, string>;
    } catch {
      return {};
    }
  }, [note]);

  useEffect(() => {
    if (state?.ok) router.push(closeHref);
  }, [state, router, closeHref]);

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="patientId" value={patientId} />
      {note ? <input type="hidden" name="noteId" value={note.id} /> : null}
      {appointmentId ? <input type="hidden" name="appointmentId" value={appointmentId} /> : null}
      <input type="hidden" name="templateId" value={templateId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Template">
          <select
            value={templateId}
            onChange={(e) => setTemplateId(Number(e.target.value))}
            disabled={Boolean(note)}
            className={clsx(selectClass, note && "bg-canvas text-ink-400")}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Signing practitioner">
          <select
            name="practitionerId"
            defaultValue={note?.practitioner_id ?? defaultPractitionerId ?? practitioners[0]?.id}
            className={selectClass}
          >
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
                {p.credentials ? `, ${p.credentials}` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Note title">
        <input
          name="title"
          defaultValue={note?.title ?? `${template?.name ?? "Chart note"} — ${todayKey()}`}
          className={inputClass}
        />
      </Field>

      <div className="space-y-3">
        {fields.map((f) => {
          const value = body[f.key] ?? "";
          if (f.type === "scale") {
            return (
              <Field key={f.key} label={f.label}>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  name={`field:${f.key}`}
                  defaultValue={value}
                  className={`${inputClass} max-w-28`}
                />
              </Field>
            );
          }
          if (f.type === "checkbox") {
            return (
              <label key={f.key} className="flex items-center gap-2 text-[13px] text-ink-700">
                <input
                  type="checkbox"
                  name={`field:${f.key}`}
                  value="yes"
                  defaultChecked={value === "yes"}
                  className="size-4 rounded border-line text-brand-600 focus:ring-brand-300"
                />
                {f.label}
              </label>
            );
          }
          if (f.type === "text") {
            return (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <input
                  name={`field:${f.key}`}
                  defaultValue={value}
                  placeholder={f.placeholder}
                  className={inputClass}
                />
              </Field>
            );
          }
          return (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <textarea
                name={`field:${f.key}`}
                rows={4}
                defaultValue={value}
                placeholder={f.placeholder}
                className={`${inputClass} leading-relaxed`}
              />
            </Field>
          );
        })}
      </div>

      {body.addendum ? (
        <input type="hidden" name="field:addendum" value={body.addendum} />
      ) : null}

      <p className="flex items-start gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[12.5px] text-ink-400">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        Signing locks the note. After that it can only be extended with a timestamped addendum —
        the original text is never rewritten.
      </p>

      {state && !state.ok ? (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push(closeHref)}>
          Cancel
        </Button>
        <Button type="submit" name="intent" value="draft" variant="secondary" disabled={pending}>
          <Save className="size-4" />
          Save draft
        </Button>
        <Button type="submit" name="intent" value="sign" variant="primary" disabled={pending}>
          <PenLine className="size-4" />
          {pending ? "Signing…" : "Sign & lock"}
        </Button>
      </div>
    </form>
  );
}
