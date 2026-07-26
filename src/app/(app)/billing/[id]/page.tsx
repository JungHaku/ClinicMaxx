import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/Sidebar";
import { PrintButton } from "@/components/billing/PrintButton";
import { Badge, Card, CardHeader, TableShell, td, th } from "@/components/ui";
import {
  AddItemForm,
  PaymentForm,
  RemoveItemButton,
  SubmitClaimForm,
  VoidInvoiceButton,
} from "@/components/billing/InvoiceActions";
import {
  getClinic,
  getInvoice,
  getPatient,
  invoiceClaims,
  invoiceItems,
  invoicePayments,
  listProducts,
  patientPolicies,
} from "@/lib/queries";
import { fmtDate, money, titleCase } from "@/lib/format";
import { CLAIM_STATUS, INVOICE_STATUS } from "@/lib/colors";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const inv = getInvoice(Number(id));
  return { title: inv ? inv.number : "Invoice" };
}

export default async function InvoicePage({ params }: { params: Params }) {
  const { id } = await params;
  const invoice = getInvoice(Number(id));
  if (!invoice) notFound();

  const clinic = getClinic();
  const patient = getPatient(invoice.patient_id);
  const items = invoiceItems(invoice.id);
  const payments = invoicePayments(invoice.id);
  const claims = invoiceClaims(invoice.id);
  const policies = patient ? patientPolicies(patient.id) : [];
  const products = listProducts();

  const owing = invoice.total_cents - invoice.paid_cents;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print">
        <BackLink href="/billing">Billing</BackLink>
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">
              {invoice.number}
            </h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${INVOICE_STATUS[invoice.status].chip}`}
            >
              {INVOICE_STATUS[invoice.status].label}
            </span>
          </div>
          <p className="mt-1 text-[13.5px] text-ink-400">
            Issued {fmtDate(invoice.issued_on)} to{" "}
            <Link href={`/patients/${invoice.patient_id}`} className="text-brand-700 hover:underline">
              {invoice.patient_name}
            </Link>
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          {invoice.status !== "void" && invoice.paid_cents === 0 ? (
            <VoidInvoiceButton invoiceId={invoice.id} />
          ) : null}
          <PrintButton />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------------------------------------------- the invoice */}
        <Card className="lg:col-span-2" padded={false}>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
            <div>
              <p className="text-[15px] font-semibold text-ink-900">{clinic.name}</p>
              <p className="text-[12.5px] text-ink-400">
                {clinic.phone} · {clinic.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12.5px] text-ink-400">Bill to</p>
              <p className="text-[13.5px] font-medium text-ink-900">{invoice.patient_name}</p>
              {patient?.address ? (
                <p className="text-[12px] text-ink-400">
                  {patient.address}
                  <br />
                  {patient.city} {patient.region} {patient.postal_code}
                </p>
              ) : null}
            </div>
          </div>

          <TableShell
            head={
              <>
                <th className={th}>Description</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-right`}>Unit</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={`${th} no-print w-8`} />
              </>
            }
          >
            {items.map((item) => (
              <tr key={item.id}>
                <td className={td}>
                  <span className="font-medium text-ink-900">{item.description}</span>
                  <span className="ml-2 text-[11.5px] text-ink-300">{titleCase(item.kind)}</span>
                </td>
                <td className={`${td} text-right tabular-nums`}>{item.quantity}</td>
                <td className={`${td} text-right tabular-nums`}>{money(item.unit_cents)}</td>
                <td className={`${td} text-right font-medium tabular-nums`}>
                  {money(item.amount_cents)}
                </td>
                <td className={`${td} no-print text-right`}>
                  {invoice.status !== "void" ? (
                    <RemoveItemButton invoiceId={invoice.id} itemId={item.id} />
                  ) : null}
                </td>
              </tr>
            ))}
          </TableShell>

          <div className="border-t border-line p-5">
            <dl className="ml-auto max-w-xs space-y-1.5 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-400">Subtotal</dt>
                <dd className="tabular-nums">{money(invoice.subtotal_cents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-400">Tax</dt>
                <dd className="tabular-nums">{money(invoice.tax_cents)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(invoice.total_cents)}</dd>
              </div>
              <div className="flex justify-between text-emerald-700">
                <dt>Paid</dt>
                <dd className="tabular-nums">−{money(invoice.paid_cents)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 text-[15px] font-semibold">
                <dt>Balance due</dt>
                <dd className={owing > 0 ? "text-rose-600 tabular-nums" : "tabular-nums"}>
                  {money(Math.max(0, owing))}
                </dd>
              </div>
            </dl>
          </div>

          {invoice.status !== "void" ? (
            <div className="no-print border-t border-line p-4">
              <AddItemForm invoiceId={invoice.id} products={products} />
            </div>
          ) : null}
        </Card>

        {/* ---------------------------------------------------- side */}
        <div className="no-print space-y-4">
          {owing > 0 && invoice.status !== "void" ? (
            <Card>
              <CardHeader title="Take payment" />
              <div className="mt-3">
                <PaymentForm invoiceId={invoice.id} owingCents={owing} />
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Payments" subtitle={`${payments.length} recorded`} />
            {payments.length === 0 ? (
              <p className="py-5 text-center text-[13px] text-ink-300">Nothing received yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line-soft">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink-900">
                        {titleCase(p.method)}
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-400">
                        {fmtDate(p.received_on)}
                        {p.reference ? ` · ${p.reference}` : ""}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-ink-900 tabular-nums">
                      {money(p.amount_cents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Insurance" subtitle={`${claims.length} claims on this invoice`} />
            {claims.length > 0 ? (
              <ul className="mt-3 mb-4 space-y-2">
                {claims.map((c) => (
                  <li key={c.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-medium text-ink-900">{c.insurer_name}</span>
                      <Badge className={CLAIM_STATUS[c.status].chip}>
                        {CLAIM_STATUS[c.status].label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-ink-400">
                      Billed {money(c.billed_cents)} · approved {money(c.approved_cents)} · paid{" "}
                      {money(c.paid_cents)}
                    </p>
                    {c.adjudication ? (
                      <p className="mt-1 text-[11.5px] text-ink-400">{c.adjudication}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {owing > 0 && invoice.status !== "void" ? (
              <SubmitClaimForm invoiceId={invoice.id} policies={policies} owingCents={owing} />
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
