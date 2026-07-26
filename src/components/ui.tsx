import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";

/* ---------------------------------------------------------------- Card */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-line bg-surface shadow-card",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[13px] text-ink-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/* ------------------------------------------------------------- Section */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13.5px] text-ink-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------- Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 border-brand-600 shadow-sm disabled:bg-brand-300 disabled:border-brand-300",
  secondary:
    "bg-surface text-ink-700 hover:bg-brand-50 hover:text-brand-800 border-line shadow-sm",
  subtle: "bg-brand-50 text-brand-800 hover:bg-brand-100 border-brand-100",
  ghost: "bg-transparent text-ink-500 hover:bg-white hover:text-ink-900 border-transparent",
  danger: "bg-white text-rose-700 hover:bg-rose-50 border-rose-200",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-9.5 px-4 text-[13.5px] rounded-lg gap-2",
  lg: "h-11 px-5 text-[15px] rounded-xl gap-2",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: keyof typeof BUTTON_SIZES = "md",
  className?: string,
) {
  return clsx(
    "inline-flex items-center justify-center border font-medium transition-colors select-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    "disabled:cursor-not-allowed disabled:opacity-70",
    BUTTON_STYLES[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZES;
}) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZES;
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/* --------------------------------------------------------------- Badge */

export function Badge({
  children,
  className,
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "brand" | "warn" | "danger" | "good";
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
    brand: "bg-brand-50 text-brand-700 border-brand-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap",
        tone ? tones[tone] : null,
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------- Avatar */

export function Avatar({
  name,
  color = "teal",
  size = "md",
}: {
  name: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const sizes = {
    xs: "size-6 text-[10px]",
    sm: "size-8 text-[11.5px]",
    md: "size-10 text-[13px]",
    lg: "size-14 text-[18px]",
  };
  const solids: Record<string, string> = {
    teal: "bg-teal-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-500",
    orange: "bg-orange-500",
    violet: "bg-violet-600",
    indigo: "bg-indigo-600",
    rose: "bg-rose-500",
    sky: "bg-sky-600",
    slate: "bg-slate-500",
  };
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        solids[color] ?? solids.teal,
        sizes[size],
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* --------------------------------------------------------- Stat tile */

export function StatTile({
  label,
  value,
  hint,
  trend,
  href,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: { value: string; good?: boolean } | null;
  href?: string;
  icon?: ReactNode;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-medium tracking-wide text-ink-400 uppercase">{label}</p>
        {icon ? <span className="text-brand-400">{icon}</span> : null}
      </div>
      <p className="mt-2 text-[26px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {trend ? (
          <span
            className={clsx(
              "rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold",
              trend.good === false
                ? "bg-rose-50 text-rose-600"
                : "bg-emerald-50 text-emerald-700",
            )}
          >
            {trend.value}
          </span>
        ) : null}
        {hint ? <span className="text-[12.5px] text-ink-400">{hint}</span> : null}
      </div>
    </>
  );

  const cls =
    "block rounded-xl border border-line bg-surface p-4 shadow-card transition-colors";
  return href ? (
    <Link href={href} className={clsx(cls, "hover:border-brand-300 hover:bg-brand-50/40")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/* --------------------------------------------------------- Empty state */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-brand-50/30 px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-brand-300">{icon}</div> : null}
      <p className="text-[14px] font-medium text-ink-700">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-[13px] text-ink-400">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------- Fields */

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-[12.5px] font-medium text-ink-500">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11.5px] text-ink-300">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink-900 " +
  "placeholder:text-ink-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none";

export const selectClass = inputClass + " appearance-none bg-white pr-8";

/** A label/value row for read-only detail panels. */
export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2 last:border-0">
      <dt className="shrink-0 text-[12.5px] text-ink-400">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-ink-900">{children || "—"}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- Table */

export function TableShell({
  head,
  children,
  className,
}: {
  head: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[11.5px] font-semibold tracking-wide text-ink-400 uppercase">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">{children}</tbody>
      </table>
    </div>
  );
}

export const th = "px-3 py-2.5 font-semibold";
export const td = "px-3 py-2.5 text-[13.5px] text-ink-700 align-middle";

/* -------------------------------------------------------------- Meter */

export function Meter({
  value,
  max,
  tone = "brand",
}: {
  value: number;
  max: number;
  tone?: "brand" | "warn" | "danger";
}) {
  const p = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tones = {
    brand: "bg-brand-500",
    warn: "bg-amber-500",
    danger: "bg-rose-500",
  };
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-line-soft"
      role="meter"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={clsx("h-full rounded-full", tones[tone])} style={{ width: `${p}%` }} />
    </div>
  );
}
