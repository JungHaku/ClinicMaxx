/**
 * Chart primitives — pure SVG/CSS so they render on the server with no client JS.
 *
 * Colour rules followed here:
 *  · Magnitude is encoded with a SINGLE hue (the brand teal ramp). Identity comes
 *    from the row label, never from colour, so no categorical palette is needed
 *    and nothing has to survive a colour-vision check to stay readable.
 *  · Status uses the fixed good/warning/critical steps and ALWAYS ships with a
 *    visible label and count — status colour never carries meaning on its own.
 *  · Every chart offers a table view so the numbers are reachable without colour.
 */

import { money, moneyShort } from "@/lib/format";

const INK_MUTED = "#93a9a7";
const GRID = "#eef3f2";
const BASELINE = "#dfe8e7";

const MARK = "#157a72"; // brand-700 — single-hue magnitude mark
const MARK_SOFT = "#b0e5dd"; // brand-200 — recessive companion step

export const STATUS_COLOR = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

/* ---------------------------------------------------------------- */

function TableView({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: [string, string];
  rows: Array<[string, string]>;
}) {
  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer list-none text-[11.5px] font-medium text-ink-400 hover:text-brand-700">
        <span className="group-open:hidden">Show data table</span>
        <span className="hidden group-open:inline">Hide data table</span>
      </summary>
      <table className="mt-2 w-full text-left text-[12px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-ink-400">
            <th className="py-1 font-medium">{head[0]}</th>
            <th className="py-1 text-right font-medium">{head[1]}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="py-1 text-ink-700">{k}</td>
              <td className="py-1 text-right text-ink-900 tabular-nums">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/* ------------------------------------------------------- Column chart */

export function ColumnChart({
  data,
  height = 150,
  valueLabel = "Value",
  format = moneyShort,
  fullFormat = money,
}: {
  data: Array<{ label: string; tick?: string; value: number }>;
  height?: number;
  valueLabel?: string;
  format?: (n: number) => string;
  fullFormat?: (n: number) => string;
}) {
  if (!data.length) {
    return <p className="py-8 text-center text-[13px] text-ink-300">No data for this period.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const gap = 2; // 2px surface gap between adjacent bars
  const slot = 100 / data.length;

  // Three recessive gridlines at 0 / 50 / 100 % of the scale.
  const grid = [0, 0.5, 1];

  return (
    <figure className="m-0">
      <div className="relative" style={{ height }}>
        {grid.map((g) => (
          <div
            key={g}
            className="absolute right-0 left-0 border-t"
            style={{
              bottom: `${g * 100}%`,
              borderColor: g === 0 ? BASELINE : GRID,
            }}
          />
        ))}
        <div className="absolute inset-0 flex items-end">
          {data.map((d, i) => {
            const h = (d.value / max) * 100;
            return (
              <div
                key={`${d.label}-${i}`}
                className="group relative flex h-full flex-1 items-end justify-center"
                style={{ paddingInline: gap / 2 }}
              >
                <div
                  className="w-full transition-colors"
                  style={{
                    height: `${Math.max(h, d.value > 0 ? 1.5 : 0)}%`,
                    background: MARK,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    minWidth: 3,
                  }}
                />
                {/* Hover layer — a bigger hit target than the mark itself. */}
                <div className="absolute inset-0" title={`${d.label}: ${fullFormat(d.value)}`} />
                <span
                  className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full rounded-md border border-line bg-white px-2 py-1 text-[11.5px] whitespace-nowrap shadow-pop group-hover:block"
                  style={{ color: "#0b2624" }}
                >
                  <strong className="font-semibold tabular-nums">{fullFormat(d.value)}</strong>
                  <span className="ml-1 text-ink-400">{d.label}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex" aria-hidden>
        {data.map((d, i) => (
          <span
            key={`${d.label}-tick-${i}`}
            className="flex-1 text-center text-[10.5px] whitespace-nowrap"
            style={{ color: INK_MUTED }}
          >
            {d.tick ?? ""}
          </span>
        ))}
      </div>
      <figcaption className="mt-1.5 flex items-baseline justify-between text-[11.5px]" style={{ color: INK_MUTED }}>
        <span>{data[0].label}</span>
        <span>peak {format(max)}</span>
        <span>{data[data.length - 1].label}</span>
      </figcaption>
      <TableView
        caption={valueLabel}
        head={["Period", valueLabel]}
        rows={data.map((d) => [d.label, fullFormat(d.value)])}
      />
    </figure>
  );
}

/* ------------------------------------------------------- Ranked bars */

export function RankedBars({
  data,
  valueLabel = "Value",
  format = money,
  emphasis = "solid",
}: {
  data: Array<{ label: string; sub?: string; value: number }>;
  valueLabel?: string;
  format?: (n: number) => string;
  emphasis?: "solid" | "soft";
}) {
  if (!data.length) {
    return <p className="py-8 text-center text-[13px] text-ink-300">Nothing to show yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <figure className="m-0">
      <ul className="space-y-2.5">
        {data.map((d) => (
          <li key={d.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] text-ink-700">
                {d.label}
                {d.sub ? <span className="ml-1.5 text-[11.5px] text-ink-300">{d.sub}</span> : null}
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-ink-900 tabular-nums">
                {format(d.value)}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ background: GRID }}>
              <div
                className="h-full"
                style={{
                  width: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`,
                  background: emphasis === "soft" ? MARK_SOFT : MARK,
                  borderRadius: 4,
                }}
                title={`${d.label}: ${format(d.value)}`}
              />
            </div>
          </li>
        ))}
      </ul>
      <TableView
        caption={valueLabel}
        head={["Name", valueLabel]}
        rows={data.map((d) => [d.label, format(d.value)])}
      />
    </figure>
  );
}

/* -------------------------------------------------- Status breakdown */

export interface StatusSlice {
  label: string;
  value: number;
  tone: keyof typeof STATUS_COLOR;
}

/**
 * A proportional bar for a small set of *states* (kept, cancelled, missed).
 * Every segment carries a visible label and count, which is what makes the
 * fixed status hues safe to use.
 */
export function StatusBar({ slices }: { slices: StatusSlice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) {
    return <p className="py-6 text-center text-[13px] text-ink-300">No appointments in this period.</p>;
  }

  return (
    <figure className="m-0">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {slices
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              style={{
                width: `${(s.value / total) * 100}%`,
                background: STATUS_COLOR[s.tone],
              }}
              title={`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}
            />
          ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[13px]">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: STATUS_COLOR[s.tone] }}
              aria-hidden
            />
            <span className="flex-1 text-ink-700">{s.label}</span>
            <span className="font-medium text-ink-900 tabular-nums">{s.value}</span>
            <span className="w-10 text-right text-ink-400 tabular-nums">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* ---------------------------------------------------------- Split bar */

/** Two-way split (e.g. online vs front desk) with both sides labelled. */
export function SplitBar({
  left,
  right,
}: {
  left: { label: string; value: number };
  right: { label: string; value: number };
}) {
  const total = left.value + right.value;
  const leftPct = total ? Math.round((left.value / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-medium text-ink-900">
          {left.label} <span className="text-ink-400 tabular-nums">{leftPct}%</span>
        </span>
        <span className="text-ink-400">
          {right.label} <span className="tabular-nums">{100 - leftPct}%</span>
        </span>
      </div>
      <div className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        <div style={{ width: `${leftPct}%`, background: MARK }} title={`${left.label}: ${left.value}`} />
        <div style={{ width: `${100 - leftPct}%`, background: MARK_SOFT }} title={`${right.label}: ${right.value}`} />
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink-400 tabular-nums">
        {left.value.toLocaleString()} · {right.value.toLocaleString()} appointments
      </p>
    </div>
  );
}
