"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  ListChecks,
  Menu,
  Settings,
  Stethoscope,
  Users,
  X,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/patients", label: "Clients", icon: Users },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/reports", label: "Reports", icon: Activity },
  { href: "/staff", label: "Staff", icon: Stethoscope },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({
  clinicName,
  openTasks,
}: {
  clinicName: string;
  openTasks: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={clsx(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
              active
                ? "bg-white/12 text-white"
                : "text-brand-100/75 hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon
              className={clsx("size-4.5 shrink-0", active ? "text-brand-200" : "text-brand-200/60")}
              strokeWidth={2}
            />
            <span className="flex-1">{label}</span>
            {href === "/tasks" && openTasks > 0 ? (
              <span className="rounded-full bg-brand-400/25 px-1.5 py-0.5 text-[11px] font-semibold text-brand-100 tabular-nums">
                {openTasks}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5 px-5 pt-5 pb-6"
      onClick={() => setMobileOpen(false)}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-brand-400/20 ring-1 ring-brand-300/30">
        <svg viewBox="0 0 24 24" className="size-5 text-brand-200" aria-hidden>
          <path
            d="M12 3.5c-3.6 0-6.5 2.6-6.5 6 0 2.6 1.6 4.6 3.4 6.3 1 .9 1.7 1.9 2 3 .1.5.6.9 1.1.9s1-.4 1.1-.9c.3-1.1 1-2.1 2-3 1.8-1.7 3.4-3.7 3.4-6.3 0-3.4-2.9-6-6.5-6Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path d="M12 7v5M9.5 9.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] leading-tight font-semibold tracking-tight text-white">
          ClinicMaxx
        </span>
        <span className="block truncate text-[11.5px] text-brand-200/70">{clinicName}</span>
      </span>
    </Link>
  );

  const footer = (
    <div className="border-t border-white/10 p-3">
      <Link
        href="/book"
        target="_blank"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] text-brand-100/70 transition-colors hover:bg-white/8 hover:text-white"
      >
        <ExternalLink className="size-4" strokeWidth={2} />
        Online booking page
      </Link>
      <div className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-300 text-[11.5px] font-semibold text-brand-900">
          RC
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-white">Robin Chase</span>
          <span className="block text-[11px] text-brand-200/60">Practice manager</span>
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-line text-ink-500"
          aria-label="Open navigation"
        >
          <Menu className="size-4.5" />
        </button>
        <span className="text-[14px] font-semibold text-ink-900">ClinicMaxx</span>
        <Link
          href="/schedule"
          className="inline-flex size-9 items-center justify-center rounded-lg border border-line text-ink-500"
          aria-label="Schedule"
        >
          <CalendarDays className="size-4.5" />
        </Link>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-brand-900">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 text-brand-200"
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      ) : null}

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-brand-900 lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>
    </>
  );
}

/** Small "back to X" affordance used on detail pages. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-400 transition-colors hover:text-brand-700"
    >
      <ChevronLeft className="size-3.5" />
      {children}
    </Link>
  );
}
