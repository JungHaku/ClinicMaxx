"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { inputClass } from "./ui";

export interface PickedPatient {
  id: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
}

export function PatientPicker({
  name = "patientId",
  initial,
  autoFocus,
}: {
  name?: string;
  initial?: PickedPatient | null;
  autoFocus?: boolean;
}) {
  const [picked, setPicked] = useState<PickedPatient | null>(initial ?? null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PickedPatient[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { patients: PickedPatient[] };
        setHits(data.patients);
        setOpen(true);
      } catch {
        /* superseded by a later keystroke */
      }
    }, 140);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  if (picked) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
        <input type="hidden" name={name} value={picked.id} />
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-ink-900">{picked.name}</span>
          <span className="block truncate text-[12px] text-ink-400">
            {[picked.email, picked.phone].filter(Boolean).join(" · ") || "No contact on file"}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setPicked(null);
            setQuery("");
          }}
          className="shrink-0 rounded-md p-1 text-ink-400 hover:bg-white hover:text-ink-900"
          aria-label="Choose a different client"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    // z-20 lifts the whole picker (and its dropdown) above the form fields that
    // follow it in the DOM.
    <div ref={box} className="relative z-20">
      <input type="hidden" name={name} value="" />
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-300" />
      <input
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder="Search by name, email or phone…"
        className={`${inputClass} pl-9`}
      />
      {open && hits.length > 0 ? (
        <ul className="rise absolute top-full right-0 left-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-pop">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => {
                  setPicked(h);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-brand-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink-900">{h.name}</span>
                  <span className="block truncate text-[11.5px] text-ink-400">
                    {h.email || h.phone}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-ink-300">{h.dob}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim().length >= 2 && hits.length === 0 ? (
        <div className="rise absolute top-full right-0 left-0 z-30 mt-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-[12.5px] text-ink-400 shadow-pop">
          No match. Create the client first, then book.
        </div>
      ) : null}
    </div>
  );
}
