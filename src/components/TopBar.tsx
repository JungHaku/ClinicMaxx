"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Search, UserPlus, X } from "lucide-react";
import { buttonClass } from "./ui";

interface Hit {
  id: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
}

export function TopBar({ today }: { today: string }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ⌘K / Ctrl-K focuses search from anywhere, the way front desk staff expect.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
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
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { patients: Hit[] };
        setHits(data.patients);
        setCursor(0);
        setOpen(true);
      } catch {
        /* aborted — the next keystroke owns the result */
      }
    }, 140);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function go(hit: Hit) {
    setOpen(false);
    setQuery("");
    router.push(`/patients/${hit.id}`);
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/85 px-4 py-2.5 backdrop-blur-md lg:px-7">
      <div ref={boxRef} className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-300" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !hits.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => (c + 1) % hits.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => (c - 1 + hits.length) % hits.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(hits[cursor]);
            }
          }}
          placeholder="Search clients by name, email or phone…"
          className="w-full rounded-lg border border-line bg-canvas py-2 pr-16 pl-9 text-[13.5px] text-ink-900 placeholder:text-ink-300 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
        {query ? (
          <button
            onClick={() => {
              setQuery("");
              setHits([]);
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-300 hover:text-ink-500"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-line bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-ink-300">
            ⌘K
          </kbd>
        )}

        {open && hits.length > 0 ? (
          <div className="rise absolute top-full right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
            <ul className="max-h-80 overflow-y-auto py-1">
              {hits.map((hit, i) => (
                <li key={hit.id}>
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(hit)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
                      i === cursor ? "bg-brand-50" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-ink-900">
                        {hit.name}
                      </span>
                      <span className="block truncate text-[12px] text-ink-400">
                        {hit.email || hit.phone || "No contact on file"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11.5px] text-ink-300">{hit.dob}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {open && query.trim().length >= 2 && hits.length === 0 ? (
          <div className="rise absolute top-full right-0 left-0 z-30 mt-1.5 rounded-xl border border-line bg-surface p-4 text-center shadow-pop">
            <p className="text-[13px] text-ink-400">No client matches “{query}”.</p>
            <Link
              href={`/patients/new?name=${encodeURIComponent(query)}`}
              onClick={() => setOpen(false)}
              className="mt-2 inline-block text-[13px] font-medium text-brand-700 hover:underline"
            >
              Create a new client
            </Link>
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-[12.5px] text-ink-400 xl:block">{today}</span>
        <Link href="/patients/new" className={buttonClass("secondary", "sm")}>
          <UserPlus className="size-4" />
          <span className="hidden sm:inline">New client</span>
        </Link>
        <Link href="/schedule?book=1" className={buttonClass("primary", "sm")}>
          <CalendarPlus className="size-4" />
          <span className="hidden sm:inline">New booking</span>
        </Link>
      </div>
    </header>
  );
}
