"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { X } from "lucide-react";

/**
 * A modal whose open/closed state lives in the URL, so the contents can be
 * rendered on the server. `closeHref` is where the ✕ and the backdrop go.
 */
export function Dialog({
  title,
  subtitle,
  closeHref,
  children,
  footer,
  width = "md",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  closeHref: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [closeHref, router]);

  const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-ink-900/35 backdrop-blur-[2px]"
        onClick={() => router.push(closeHref)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={clsx(
          "rise relative my-auto w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-pop",
          widths[width],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-ink-400">{subtitle}</p> : null}
          </div>
          <button
            onClick={() => router.push(closeHref)}
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-canvas hover:text-ink-900"
            aria-label="Close"
          >
            <X className="size-4.5" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 thin-scroll">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
