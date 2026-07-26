import Link from "next/link";
import clsx from "clsx";
import { Banknote, CreditCard, Landmark, Receipt, Search } from "lucide-react";
import {
  Card,
  EmptyState,
  PageHeader,
  StatTile,
  TableShell,
  td,
  th,
} from "@/components/ui";
import { RankedBars } from "@/components/charts";
import { SettleClaimForm } from "@/components/billing/SettleClaimForm";
import {
  agedReceivables,
  dashboardStats,
  listClaims,
  listInvoices,
  listPayments,
} from "@/lib/queries";
import { fmtDateShort, money, moneyShort, titleCase, todayKey } from "@/lib/format";
import { CLAIM_STATUS, INVOICE_STATUS } from "@/lib/colors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

type Search = Promise<Record<string, string | string[] | undefined>>;

const TABS = [
  ["invoices", "Invoices"],
  ["claims", "Insurance claims"],
  ["payments", "Payments"],
] as const;

const STATUS_FILTERS = [
  ["outstanding", "Outstanding"],
  ["paid", "Paid"],
  ["all", "All"],
] as const;

export default async function BillingPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) as string | undefined;

  const tab = (pick("tab") ?? "invoices") as (typeof TABS)[number][0];
  const status = pick("status") ?? "outstanding";
  const q = pick("q") ?? "";
  const claimStatus = pick("claim") ?? "all";

  const stats = dashboardStats(todayKey());
  const aged = agedReceivables();
  const agedOrder = ["0–30 days", "31–60 days", "61–90 days", "90+ days"];
  const agedData = agedOrder
    .map((bucket) => {
      const row = aged.find((a) => a.bucket === bucket);
      return { label: bucket, sub: row ? `${row.n} invoices` : "", value: row?.cents ?? 0 };
    })
    .filter((d) => d.value > 0);

  const invoices = tab === "invoices" ? listInvoices({ status, query: q, limit: 120 }) : [];
  const claims = tab === "claims" ? listClaims(claimStatus, 120) : [];
  const payments = tab === "payments" ? listPayments(120) : [];

  const collected30 = stats.mtd.revenueCents;

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle="Invoices, insurer claims and payments in one ledger."
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Outstanding"
          value={moneyShort(stats.outstandingCents)}
          hint={`${stats.outstandingCount} invoices`}
          icon={<Receipt className="size-4" />}
        />
        <StatTile
          label="With insurers"
          value={moneyShort(stats.claimsPendingCents)}
          hint={`${stats.claimsPendingCount} claims open`}
          icon={<Landmark className="size-4" />}
        />
        <StatTile
          label="Collected this month"
          value={moneyShort(collected30)}
          hint="all payment methods"
          icon={<Banknote className="size-4" />}
        />
        <StatTile
          label="Over 90 days"
          value={moneyShort(aged.find((a) => a.bucket === "90+ days")?.cents ?? 0)}
          hint="needs chasing"
          icon={<CreditCard className="size-4" />}
        />
      </div>

      {agedData.length ? (
        <Card className="mt-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink-900">
            Aged receivables
          </h2>
          <p className="mt-0.5 mb-4 text-[13px] text-ink-400">
            How long the money has been outstanding.
          </p>
          <RankedBars data={agedData} valueLabel="Outstanding" />
        </Card>
      ) : null}

      <nav className="mt-5 mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/billing?tab=${key}`}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium whitespace-nowrap transition-colors",
              tab === key
                ? "border-brand-600 text-brand-800"
                : "border-transparent text-ink-400 hover:text-ink-900",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* ---------------------------------------------------- invoices */}
      {tab === "invoices" ? (
        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
            <form action="/billing" className="relative min-w-56 flex-1">
              <input type="hidden" name="tab" value="invoices" />
              <input type="hidden" name="status" value={status} />
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-300" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search invoice number or client…"
                className="w-full rounded-lg border border-line bg-canvas py-2 pr-3 pl-9 text-[13.5px] focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 focus:outline-none"
              />
            </form>
            <div className="flex items-center rounded-lg border border-line bg-surface p-0.5">
              {STATUS_FILTERS.map(([key, label]) => (
                <Link
                  key={key}
                  href={`/billing?tab=invoices&status=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={clsx(
                    "rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                    status === key ? "bg-brand-600 text-white" : "text-ink-500 hover:text-ink-900",
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No invoices match"
                body="Try a different status filter or search term."
                icon={<Receipt className="size-8" />}
              />
            </div>
          ) : (
            <TableShell
              head={
                <>
                  <th className={th}>Invoice</th>
                  <th className={th}>Client</th>
                  <th className={th}>Issued</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Total</th>
                  <th className={`${th} text-right`}>Paid</th>
                  <th className={`${th} text-right`}>Owing</th>
                </>
              }
            >
              {invoices.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-brand-50/30">
                  <td className={td}>
                    <Link href={`/billing/${inv.id}`} className="font-medium text-brand-700 hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className={td}>
                    <Link href={`/patients/${inv.patient_id}`} className="hover:underline">
                      {inv.patient_name}
                    </Link>
                  </td>
                  <td className={td}>{fmtDateShort(inv.issued_on)}</td>
                  <td className={td}>
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${INVOICE_STATUS[inv.status].chip}`}
                    >
                      {INVOICE_STATUS[inv.status].label}
                    </span>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{money(inv.total_cents)}</td>
                  <td className={`${td} text-right tabular-nums`}>{money(inv.paid_cents)}</td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>
                    {inv.balance_cents > 0 ? (
                      <span className="text-rose-600">{money(inv.balance_cents)}</span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </Card>
      ) : null}

      {/* ------------------------------------------------------ claims */}
      {tab === "claims" ? (
        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line p-3">
            {["all", "submitted", "accepted", "paid", "rejected"].map((s) => (
              <Link
                key={s}
                href={`/billing?tab=claims&claim=${s}`}
                className={clsx(
                  "rounded-full border px-2.5 py-1 text-[12.5px] font-medium capitalize transition-colors",
                  claimStatus === s
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-surface text-ink-500 hover:border-brand-300",
                )}
              >
                {s}
              </Link>
            ))}
          </div>

          {claims.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No claims here" icon={<Landmark className="size-8" />} />
            </div>
          ) : (
            <TableShell
              head={
                <>
                  <th className={th}>Insurer</th>
                  <th className={th}>Client</th>
                  <th className={th}>Invoice</th>
                  <th className={th}>Submitted</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Billed</th>
                  <th className={`${th} text-right`}>Paid</th>
                  <th className={`${th} text-right`}>Action</th>
                </>
              }
            >
              {claims.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-brand-50/30">
                  <td className={`${td} font-medium text-ink-900`}>{c.insurer_name}</td>
                  <td className={td}>
                    <Link href={`/patients/${c.patient_id}`} className="hover:underline">
                      {c.patient_name}
                    </Link>
                  </td>
                  <td className={td}>
                    <Link href={`/billing/${c.invoice_id}`} className="text-brand-700 hover:underline">
                      {c.invoice_number}
                    </Link>
                  </td>
                  <td className={td}>{c.submitted_on ? fmtDateShort(c.submitted_on) : "—"}</td>
                  <td className={td}>
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${CLAIM_STATUS[c.status].chip}`}
                    >
                      {CLAIM_STATUS[c.status].label}
                    </span>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{money(c.billed_cents)}</td>
                  <td className={`${td} text-right tabular-nums`}>{money(c.paid_cents)}</td>
                  <td className={`${td} text-right`}>
                    {c.status === "submitted" || c.status === "accepted" ? (
                      <SettleClaimForm claimId={c.id} approvedCents={c.approved_cents} />
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </Card>
      ) : null}

      {/* ---------------------------------------------------- payments */}
      {tab === "payments" ? (
        <Card padded={false}>
          {payments.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No payments recorded" icon={<Banknote className="size-8" />} />
            </div>
          ) : (
            <TableShell
              head={
                <>
                  <th className={th}>Received</th>
                  <th className={th}>Client</th>
                  <th className={th}>Invoice</th>
                  <th className={th}>Method</th>
                  <th className={th}>Reference</th>
                  <th className={`${th} text-right`}>Amount</th>
                </>
              }
            >
              {payments.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-brand-50/30">
                  <td className={td}>{fmtDateShort(p.received_on)}</td>
                  <td className={td}>
                    <Link href={`/patients/${p.patient_id}`} className="hover:underline">
                      {p.patient_name}
                    </Link>
                  </td>
                  <td className={td}>
                    <Link href={`/billing/${p.invoice_id}`} className="text-brand-700 hover:underline">
                      {p.invoice_number}
                    </Link>
                  </td>
                  <td className={td}>{titleCase(p.method)}</td>
                  <td className={`${td} text-ink-400`}>{p.reference || p.note || "—"}</td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>
                    {money(p.amount_cents)}
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </Card>
      ) : null}
    </>
  );
}
