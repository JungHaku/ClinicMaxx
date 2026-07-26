import Link from "next/link";
import clsx from "clsx";
import { Card, CardHeader, PageHeader, StatTile, TableShell, td, th } from "@/components/ui";
import { ColumnChart, RankedBars, SplitBar, StatusBar } from "@/components/charts";
import {
  attendanceBreakdown,
  bookingSourceSplit,
  insurerPerformance,
  newVsReturning,
  referralSources,
  retentionCohort,
  revenueByDay,
  revenueByDiscipline,
  revenueByPractitioner,
  topTreatments,
} from "@/lib/queries";
import { addDays, fmtDate, money, moneyShort, parseLocal, pct, todayKey } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

type Search = Promise<Record<string, string | string[] | undefined>>;

const RANGES = [
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
  ["mtd", "Month to date"],
] as const;

export default async function ReportsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const range = ((Array.isArray(sp.range) ? sp.range[0] : sp.range) ?? "30") as string;

  const today = todayKey();
  const from = range === "mtd" ? `${today.slice(0, 7)}-01` : addDays(today, -(Number(range) - 1));
  const days = Math.round(
    (parseLocal(today).getTime() - parseLocal(from).getTime()) / 86_400_000,
  ) + 1;

  const byDay = revenueByDay(from, today);
  const dayMap = new Map(byDay.map((d) => [d.day, d.cents]));
  const series = Array.from({ length: days }, (_, i) => {
    const key = addDays(from, i);
    const d = parseLocal(key);
    const every = days > 45 ? 7 : days > 20 ? 3 : 1;
    return {
      label: fmtDate(key),
      tick: i % every === 0 ? `${d.getDate()}` : "",
      value: dayMap.get(key) ?? 0,
    };
  });

  const collected = series.reduce((s, d) => s + d.value, 0);
  const byPractitioner = revenueByPractitioner(from, today);
  const byDiscipline = revenueByDiscipline(from, today);
  const treatments = topTreatments(from, today);
  const attendance = attendanceBreakdown(from, today);
  const sources = bookingSourceSplit(from, today);
  const cohort = newVsReturning(from, today);
  const insurers = insurerPerformance(from, today);
  const referrals = referralSources().slice(0, 8);
  const retention = retentionCohort();

  const count = (s: string) => attendance.find((a) => a.status === s)?.n ?? 0;
  const totalAppts = attendance.reduce((s, a) => s + a.n, 0);
  const kept = count("completed") + count("arrived") + count("booked");
  const visits = byPractitioner.reduce((s, p) => s + p.visits, 0);
  const billed = byPractitioner.reduce((s, p) => s + p.cents, 0);

  const online = sources.find((s) => s.source === "online")?.n ?? 0;
  const staffBooked = sources.find((s) => s.source === "staff")?.n ?? 0;

  const retentionOrder = ["1 visit", "2–3 visits", "4–7 visits", "8–15 visits", "16+ visits"];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`${fmtDate(from)} — ${fmtDate(today)}`}
        actions={
          <div className="flex items-center rounded-lg border border-line bg-surface p-0.5 shadow-card">
            {RANGES.map(([key, label]) => (
              <Link
                key={key}
                href={`/reports?range=${key}`}
                className={clsx(
                  "rounded-md px-2.5 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors",
                  range === key ? "bg-brand-600 text-white" : "text-ink-500 hover:text-ink-900",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Collected" value={moneyShort(collected)} hint="payments received" />
        <StatTile label="Billed" value={moneyShort(billed)} hint={`${visits} completed visits`} />
        <StatTile
          label="Average visit"
          value={visits ? money(Math.round(billed / visits)) : "—"}
          hint="per completed appointment"
        />
        <StatTile
          label="Kept appointments"
          value={pct(kept, totalAppts)}
          hint={`${count("no_show")} no-shows · ${count("cancelled")} cancelled`}
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Payments received"
          subtitle="Daily total across every payment method"
          action={
            <span className="text-[15px] font-semibold text-ink-900 tabular-nums">
              {money(collected)}
            </span>
          }
        />
        <div className="mt-4">
          <ColumnChart data={series} valueLabel="Payments" height={180} />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Billings by practitioner" subtitle="Completed visits only" />
          <div className="mt-4">
            <RankedBars
              data={byPractitioner.map((p) => ({
                label: p.name,
                sub: `${p.visits} visits · ${p.discipline}`,
                value: p.cents,
              }))}
              valueLabel="Billed"
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Billings by discipline" />
          <div className="mt-4">
            <RankedBars
              data={byDiscipline.map((d) => ({
                label: d.discipline,
                sub: `${d.visits} visits`,
                value: d.cents,
              }))}
              valueLabel="Billed"
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Attendance" subtitle={`${totalAppts} appointments in range`} />
          <div className="mt-4">
            <StatusBar
              slices={[
                { label: "Completed", value: count("completed"), tone: "good" },
                { label: "Still booked", value: count("booked") + count("arrived"), tone: "warning" },
                { label: "Cancelled", value: count("cancelled"), tone: "serious" },
                { label: "No show", value: count("no_show"), tone: "critical" },
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Where bookings come from" />
          <div className="mt-4 space-y-5">
            <SplitBar
              left={{ label: "Booked online", value: online }}
              right={{ label: "Booked by staff", value: staffBooked }}
            />
            <div className="border-t border-line-soft pt-4">
              <SplitBar
                left={{ label: "First visits", value: cohort.first }}
                right={{ label: "Returning", value: cohort.returning }}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Most-booked treatments" />
          <div className="mt-4">
            <RankedBars
              data={treatments.map((t) => ({
                label: t.name,
                sub: `${t.visits}×`,
                value: t.cents,
              }))}
              valueLabel="Billed"
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Client retention" subtitle="Lifetime completed visits per client" />
          <div className="mt-4">
            <RankedBars
              data={retentionOrder
                .map((bucket) => ({
                  label: bucket,
                  value: retention.find((r) => r.bucket === bucket)?.n ?? 0,
                }))
                .filter((d) => d.value > 0)}
              valueLabel="Clients"
              format={(n) => String(n)}
              emphasis="soft"
            />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card padded={false}>
          <div className="p-5 pb-2">
            <CardHeader title="Insurer performance" subtitle="Claims submitted in this range" />
          </div>
          {insurers.length === 0 ? (
            <p className="px-5 pb-6 text-center text-[13px] text-ink-300">
              No claims submitted in this range.
            </p>
          ) : (
            <TableShell
              className="px-2 pb-2"
              head={
                <>
                  <th className={th}>Insurer</th>
                  <th className={`${th} text-right`}>Claims</th>
                  <th className={`${th} text-right`}>Billed</th>
                  <th className={`${th} text-right`}>Paid</th>
                  <th className={`${th} text-right`}>Outstanding</th>
                </>
              }
            >
              {insurers.map((i) => (
                <tr key={i.insurer_name}>
                  <td className={`${td} font-medium text-ink-900`}>{i.insurer_name}</td>
                  <td className={`${td} text-right tabular-nums`}>{i.claims}</td>
                  <td className={`${td} text-right tabular-nums`}>{money(i.billed)}</td>
                  <td className={`${td} text-right tabular-nums`}>{money(i.paid)}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {i.outstanding > 0 ? (
                      <span className="font-semibold text-rose-600">{money(i.outstanding)}</span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </Card>

        <Card>
          <CardHeader title="How clients found us" subtitle="Across the whole client list" />
          <div className="mt-4">
            <RankedBars
              data={referrals.map((r) => ({ label: r.referral_source, value: r.n }))}
              valueLabel="Clients"
              format={(n) => String(n)}
              emphasis="soft"
            />
          </div>
        </Card>
      </div>
    </>
  );
}
