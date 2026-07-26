import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileWarning,
  Landmark,
  TrendingUp,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  Meter,
  PageHeader,
  StatTile,
} from "@/components/ui";
import { ColumnChart, RankedBars } from "@/components/charts";
import { TaskRow } from "@/components/TaskRow";
import {
  appointmentsOn,
  dashboardStats,
  listTasks,
  revenueByDay,
  revenueByPractitioner,
} from "@/lib/queries";
import { all } from "@/lib/db";
import {
  addDays,
  fmtDate,
  fmtTime,
  money,
  moneyShort,
  parseLocal,
  relativeDay,
  todayKey,
} from "@/lib/format";
import { APPOINTMENT_STATUS } from "@/lib/colors";
import type { ChartNoteView } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  const today = todayKey();
  const stats = dashboardStats(today);
  const appts = appointmentsOn(today);
  const tasks = listTasks("open").slice(0, 6);

  const from = addDays(today, -13);
  const byDay = revenueByDay(from, today);
  const dayMap = new Map(byDay.map((d) => [d.day, d.cents]));
  const series = Array.from({ length: 14 }, (_, i) => {
    const key = addDays(from, i);
    const d = parseLocal(key);
    return {
      label: fmtDate(key),
      tick: i % 3 === 0 ? `${d.getDate()}` : "",
      value: dayMap.get(key) ?? 0,
    };
  });

  const monthStart = `${today.slice(0, 7)}-01`;
  const leaders = revenueByPractitioner(monthStart, today)
    .filter((r) => r.cents > 0)
    .slice(0, 6)
    .map((r) => ({ label: r.name, sub: `${r.visits} visits`, value: r.cents }));

  const unsigned = all<ChartNoteView>(
    `SELECT n.*, pr.first_name || ' ' || pr.last_name AS practitioner_name, pr.credentials,
            NULL AS template_name, p.first_name || ' ' || p.last_name AS patient_name
       FROM chart_notes n
       JOIN practitioners pr ON pr.id = n.practitioner_id
       JOIN patients p ON p.id = n.patient_id
      WHERE n.status = 'draft' ORDER BY n.created_at DESC LIMIT 5`,
  ) as Array<ChartNoteView & { patient_name: string }>;

  const revenueDelta =
    stats.mtd.prevRevenueCents > 0
      ? Math.round(
          ((stats.mtd.revenueCents - stats.mtd.prevRevenueCents) / stats.mtd.prevRevenueCents) * 100,
        )
      : null;

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const upNext = appts.find((a) => {
    const [h, m] = a.starts_at.split("T")[1].split(":").map(Number);
    return h * 60 + m >= nowMin && a.status === "booked";
  });

  return (
    <>
      <PageHeader
        title="Today at the clinic"
        subtitle={`${stats.today.total} appointments booked · ${stats.utilisationPct}% of available hours filled`}
        actions={
          <>
            <LinkButton href="/schedule" variant="secondary" size="sm">
              Open schedule
            </LinkButton>
            <LinkButton href="/schedule?book=1" variant="primary" size="sm">
              New booking
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Appointments today"
          value={stats.today.total}
          hint={`${stats.today.completed} seen · ${stats.today.booked} to come`}
          icon={<CalendarCheck className="size-4" />}
          href="/schedule"
        />
        <StatTile
          label="Revenue month to date"
          value={moneyShort(stats.mtd.revenueCents)}
          trend={
            revenueDelta === null
              ? null
              : { value: `${revenueDelta >= 0 ? "+" : ""}${revenueDelta}%`, good: revenueDelta >= 0 }
          }
          hint="vs same point last month"
          icon={<TrendingUp className="size-4" />}
          href="/reports"
        />
        <StatTile
          label="Outstanding balances"
          value={moneyShort(stats.outstandingCents)}
          hint={`${stats.outstandingCount} unpaid invoices`}
          icon={<CreditCard className="size-4" />}
          href="/billing?status=outstanding"
        />
        <StatTile
          label="With insurers"
          value={moneyShort(stats.claimsPendingCents)}
          hint={`${stats.claimsPendingCount} claims awaiting remittance`}
          icon={<Landmark className="size-4" />}
          href="/billing?tab=claims"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* ------------------------------------------------ today's list */}
        <Card className="xl:col-span-2" padded={false}>
          <div className="flex items-start justify-between gap-4 p-5 pb-3">
            <CardHeader
              title="Today's schedule"
              subtitle={
                upNext
                  ? `Up next: ${upNext.patient_name} with ${upNext.practitioner_name} at ${fmtTime(upNext.starts_at)}`
                  : "Nothing further booked today"
              }
              className="flex-1"
            />
            <Link
              href="/schedule"
              className="flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:underline"
            >
              Full calendar <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {appts.length === 0 ? (
            <div className="p-5 pt-0">
              <EmptyState
                title="No appointments today"
                body="The calendar is clear. A good day for catching up on charting."
                icon={<CalendarCheck className="size-7" />}
              />
            </div>
          ) : (
            <ul className="max-h-[560px] divide-y divide-line-soft overflow-y-auto thin-scroll">
              {appts.map((a) => {
                const status = APPOINTMENT_STATUS[a.status];
                return (
                  <li key={a.id}>
                    <Link
                      href={`/schedule?date=${today}&appt=${a.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-brand-50/50"
                    >
                      <span className="w-16 shrink-0 text-right text-[12.5px] font-medium text-ink-500 tabular-nums">
                        {fmtTime(a.starts_at)}
                      </span>
                      <Avatar name={a.patient_name} color={a.practitioner_color} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-medium text-ink-900">
                            {a.patient_name}
                          </span>
                          {a.is_first_visit ? (
                            <Badge tone="brand" className="px-1.5 py-0">
                              1st
                            </Badge>
                          ) : null}
                        </span>
                        <span className="block truncate text-[12px] text-ink-400">
                          {a.treatment_name} · {a.practitioner_name}
                        </span>
                      </span>
                      {a.status === "completed" && !a.has_note ? (
                        <Badge tone="warn" className="hidden sm:inline-flex">
                          <FileWarning className="size-3" />
                          No note
                        </Badge>
                      ) : null}
                      <span
                        className={`hidden rounded-full border px-2 py-0.5 text-[11.5px] font-medium sm:inline-block ${status.chip}`}
                      >
                        {status.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* ---------------------------------------------------- side rail */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Chair utilisation" subtitle="Booked minutes against working hours" />
            <p className="mt-3 text-[28px] leading-none font-semibold text-ink-900 tabular-nums">
              {stats.utilisationPct}%
            </p>
            <div className="mt-2.5">
              <Meter
                value={stats.utilisationPct}
                max={100}
                tone={stats.utilisationPct > 85 ? "warn" : "brand"}
              />
            </div>
            <p className="mt-2 text-[12px] text-ink-400">
              {stats.utilisationPct > 85
                ? "Nearly full — consider opening overflow hours."
                : stats.utilisationPct < 45
                  ? "Plenty of open slots. A good day to call the waitlist."
                  : "A comfortable day with room for walk-ins."}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line-soft pt-3">
              <div>
                <dt className="text-[11.5px] text-ink-400">Arrived</dt>
                <dd className="text-[15px] font-semibold text-ink-900 tabular-nums">
                  {stats.today.arrived}
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] text-ink-400">Cancelled</dt>
                <dd className="text-[15px] font-semibold text-ink-900 tabular-nums">
                  {stats.today.cancelled}
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] text-ink-400">No show</dt>
                <dd className="text-[15px] font-semibold text-ink-900 tabular-nums">
                  {stats.today.noShow}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Tasks"
              subtitle={`${stats.openTasks} open`}
              action={
                <Link href="/tasks" className="text-[12.5px] font-medium text-brand-700 hover:underline">
                  All
                </Link>
              }
            />
            {tasks.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-300">Nothing outstanding.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} compact />
                ))}
              </ul>
            )}
          </Card>

          {unsigned.length > 0 ? (
            <Card>
              <CardHeader
                title="Unsigned notes"
                subtitle="Drafts waiting on a signature"
                action={<Badge tone="warn">{stats.unsignedNotes}</Badge>}
              />
              <ul className="mt-3 space-y-2">
                {unsigned.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/patients/${n.patient_id}?tab=chart&note=${n.id}`}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-brand-50/60"
                    >
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink-900">
                          {n.patient_name}
                        </span>
                        <span className="block truncate text-[11.5px] text-ink-400">
                          {n.title} · {n.practitioner_name}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>

      {/* ------------------------------------------------------- charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Payments received"
            subtitle="Last 14 days, all methods"
            action={
              <span className="text-[13px] font-semibold text-ink-900 tabular-nums">
                {money(series.reduce((s, d) => s + d.value, 0))}
              </span>
            }
          />
          <div className="mt-4">
            <ColumnChart data={series} valueLabel="Payments" />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Practitioner billings"
            subtitle={`Month to date · ${relativeDay(today) === "today" ? "as of today" : ""}`}
            action={
              <Link href="/reports" className="text-[12.5px] font-medium text-brand-700 hover:underline">
                Reports
              </Link>
            }
          />
          <div className="mt-4">
            {leaders.length ? (
              <RankedBars data={leaders} valueLabel="Billings" />
            ) : (
              <EmptyState
                title="No completed visits this month"
                icon={<ClipboardList className="size-7" />}
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
