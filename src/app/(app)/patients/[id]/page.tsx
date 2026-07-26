import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import {
  AlertTriangle,
  CalendarPlus,
  FilePlus2,
  FileText,
  Lock,
  Mail,
  MapPin,
  Phone,
  Plus,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { BackLink } from "@/components/Sidebar";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  DetailRow,
  EmptyState,
  LinkButton,
  Meter,
  TableShell,
  td,
  th,
} from "@/components/ui";
import { Dialog } from "@/components/Dialog";
import { ChartNoteEditor } from "@/components/chart/ChartNoteEditor";
import { AddendumForm } from "@/components/chart/AddendumForm";
import { PolicyForm } from "@/components/patient/PolicyForm";
import { CommunicationForm } from "@/components/patient/CommunicationForm";
import {
  getNote,
  getPatient,
  listChartTemplates,
  listPractitioners,
  patientAppointments,
  patientCommunications,
  patientInvoices,
  patientNotes,
  patientPolicies,
  upcomingFor,
} from "@/lib/queries";
import {
  age,
  fmtDate,
  fmtDateShort,
  fmtTimeRange,
  money,
  pct,
  relativeDay,
  titleCase,
} from "@/lib/format";
import { APPOINTMENT_STATUS, INVOICE_STATUS } from "@/lib/colors";
import type { ChartField } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

const TABS = [
  ["overview", "Overview"],
  ["chart", "Chart"],
  ["appointments", "Appointments"],
  ["billing", "Billing"],
  ["messages", "Communications"],
] as const;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const p = getPatient(Number(id));
  return { title: p ? `${p.first_name} ${p.last_name}` : "Client" };
}

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) as string | undefined;

  const patientId = Number(id);
  const patient = getPatient(patientId);
  if (!patient) notFound();

  const tab = (pick("tab") ?? "overview") as (typeof TABS)[number][0];
  const name = `${patient.first_name} ${patient.last_name}`;
  const tags = patient.tags ? patient.tags.split(",").filter(Boolean) : [];

  const policies = patientPolicies(patientId);
  const notes = patientNotes(patientId);
  const appointments = patientAppointments(patientId);
  const invoices = patientInvoices(patientId);
  const upcoming = upcomingFor(patientId);
  const comms = patientCommunications(patientId);
  const practitioners = listPractitioners().filter((p) => p.role !== "admin");
  const templates = listChartTemplates();

  const baseHref = `/patients/${patientId}?tab=${tab}`;
  const openNoteId = Number(pick("note") ?? 0);
  const openNote = openNoteId ? getNote(openNoteId) : undefined;
  const composing = pick("new") === "1";
  const editingPolicy = pick("policy");

  const lifetimeValue = invoices
    .filter((i) => i.status !== "void")
    .reduce((s, i) => s + i.total_cents, 0);

  return (
    <>
      <BackLink href="/patients">All clients</BackLink>

      {/* ------------------------------------------------------ header */}
      <div className="flex flex-wrap items-start gap-4 pb-4">
        <Avatar name={name} size="lg" color="slate" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">{name}</h1>
            {patient.preferred_name ? (
              <span className="text-[14px] text-ink-400">“{patient.preferred_name}”</span>
            ) : null}
            {tags.map((t) => (
              <Badge key={t} tone={t === "New client" ? "brand" : "neutral"}>
                {t}
              </Badge>
            ))}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-400">
            {age(patient.date_of_birth) !== null ? (
              <span>
                {age(patient.date_of_birth)} yrs · {fmtDate(patient.date_of_birth)}
              </span>
            ) : null}
            {patient.pronouns ? <span>{patient.pronouns}</span> : null}
            {patient.phone ? (
              <a href={`tel:${patient.phone.replace(/\D/g, "")}`} className="flex items-center gap-1 hover:text-brand-700">
                <Phone className="size-3.5" />
                {patient.phone}
              </a>
            ) : null}
            {patient.email ? (
              <a href={`mailto:${patient.email}`} className="flex items-center gap-1 hover:text-brand-700">
                <Mail className="size-3.5" />
                {patient.email}
              </a>
            ) : null}
            {patient.city ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {patient.city}, {patient.region}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/patients/${patientId}/edit`} variant="secondary" size="sm">
            Edit
          </LinkButton>
          <LinkButton href={`${baseHref}&new=1`} variant="secondary" size="sm">
            <FilePlus2 className="size-4" />
            Chart note
          </LinkButton>
          <LinkButton href="/schedule?book=1" variant="primary" size="sm">
            <CalendarPlus className="size-4" />
            Book
          </LinkButton>
        </div>
      </div>

      {patient.alert ? (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13.5px] text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">Alert · </strong>
            {patient.alert}
          </span>
        </p>
      ) : null}

      {/* -------------------------------------------------- quick stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Visits" value={String(patient.visit_count)} hint="completed" />
        <MiniStat
          label="Last seen"
          value={patient.last_visit ? fmtDateShort(patient.last_visit.slice(0, 10)) : "Never"}
          hint={patient.last_visit ? relativeDay(patient.last_visit.slice(0, 10)) : "no history"}
        />
        <MiniStat
          label="Next visit"
          value={patient.next_visit ? fmtDateShort(patient.next_visit.slice(0, 10)) : "Not booked"}
          hint={patient.next_visit ? relativeDay(patient.next_visit.slice(0, 10)) : "—"}
          tone={patient.next_visit ? "brand" : "muted"}
        />
        <MiniStat
          label="Balance"
          value={money(patient.balance_cents)}
          hint={`${money(lifetimeValue)} lifetime`}
          tone={patient.balance_cents > 0 ? "danger" : "muted"}
        />
      </div>

      {/* -------------------------------------------------------- tabs */}
      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/patients/${patientId}?tab=${key}`}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium whitespace-nowrap transition-colors",
              tab === key
                ? "border-brand-600 text-brand-800"
                : "border-transparent text-ink-400 hover:text-ink-900",
            )}
          >
            {label}
            {key === "chart" && notes.length ? (
              <span className="ml-1.5 text-[11.5px] text-ink-300">{notes.length}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      {/* ---------------------------------------------------- overview */}
      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader title="Upcoming appointments" />
              {upcoming.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-ink-300">Nothing booked.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line-soft">
                  {upcoming.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/schedule?date=${a.starts_at.slice(0, 10)}&appt=${a.id}`}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <span className="w-24 shrink-0 text-[13px] font-medium text-ink-900">
                          {fmtDateShort(a.starts_at.slice(0, 10))}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] text-ink-900">
                            {a.treatment_name}
                          </span>
                          <span className="block text-[12px] text-ink-400">
                            {fmtTimeRange(a.starts_at, a.ends_at)} · {a.practitioner_name}
                          </span>
                        </span>
                        <Badge tone="brand">{relativeDay(a.starts_at.slice(0, 10))}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Recent chart notes"
                action={
                  <Link href={`/patients/${patientId}?tab=chart`} className="text-[12.5px] font-medium text-brand-700 hover:underline">
                    All notes
                  </Link>
                }
              />
              {notes.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-ink-300">No notes on file yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {notes.slice(0, 4).map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/patients/${patientId}?tab=chart&note=${n.id}`}
                        className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <FileText className="size-4 shrink-0 text-ink-300" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink-900">
                            {n.title}
                          </span>
                          <span className="block text-[12px] text-ink-400">
                            {n.practitioner_name}
                            {n.credentials ? `, ${n.credentials}` : ""} ·{" "}
                            {fmtDateShort(n.created_at.slice(0, 10))}
                          </span>
                        </span>
                        {n.status === "signed" ? (
                          <Lock className="size-3.5 text-ink-300" aria-label="Signed" />
                        ) : (
                          <Badge tone="warn">Draft</Badge>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Details" />
              <dl className="mt-2">
                <DetailRow label="Occupation">{patient.occupation}</DetailRow>
                <DetailRow label="Family doctor">{patient.family_doctor}</DetailRow>
                <DetailRow label="Found us via">{patient.referral_source}</DetailRow>
                <DetailRow label="Emergency">
                  {patient.emergency_name
                    ? `${patient.emergency_name} · ${patient.emergency_phone}`
                    : ""}
                </DetailRow>
                <DetailRow label="Client since">{fmtDate(patient.created_at)}</DetailRow>
                <DetailRow label="Intake">
                  {patient.intake_completed ? (
                    <span className="text-emerald-700">Complete</span>
                  ) : (
                    <span className="text-amber-700">Outstanding</span>
                  )}
                </DetailRow>
                <DetailRow label="Consent">
                  {patient.consent_signed ? (
                    <span className="text-emerald-700">Signed</span>
                  ) : (
                    <span className="text-amber-700">Not signed</span>
                  )}
                </DetailRow>
              </dl>
              {patient.notes ? (
                <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[12.5px] leading-relaxed text-ink-700">
                  {patient.notes}
                </p>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                title="Insurance"
                action={
                  <Link
                    href={`${baseHref}&policy=new`}
                    className="flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:underline"
                  >
                    <Plus className="size-3.5" /> Add
                  </Link>
                }
              />
              {policies.length === 0 ? (
                <p className="py-5 text-center text-[13px] text-ink-300">No plans on file.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {policies.map((pol) => {
                    const remaining = Math.max(0, pol.annual_max_cents - pol.used_cents);
                    return (
                      <li key={pol.id} className="rounded-lg border border-line p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-ink-900">
                              {pol.insurer_name}
                            </p>
                            <p className="text-[11.5px] text-ink-400">
                              {titleCase(pol.plan_type)} · {pol.coverage_percent}% covered
                              {pol.is_primary ? " · primary" : " · secondary"}
                            </p>
                          </div>
                          <Link
                            href={`${baseHref}&policy=${pol.id}`}
                            className="shrink-0 text-[12px] font-medium text-brand-700 hover:underline"
                          >
                            Edit
                          </Link>
                        </div>
                        {pol.direct_billing ? (
                          <Badge tone="good" className="mt-2">
                            <ShieldCheck className="size-3" /> Direct billing
                          </Badge>
                        ) : null}
                        {pol.annual_max_cents > 0 ? (
                          <div className="mt-2.5">
                            <div className="mb-1 flex justify-between text-[11.5px] text-ink-400">
                              <span>{money(remaining)} remaining</span>
                              <span>{pct(pol.used_cents, pol.annual_max_cents)} used</span>
                            </div>
                            <Meter
                              value={pol.used_cents}
                              max={pol.annual_max_cents}
                              tone={
                                pol.used_cents / pol.annual_max_cents > 0.85 ? "danger" : "brand"
                              }
                            />
                          </div>
                        ) : null}
                        {pol.visits_allowed > 0 ? (
                          <p className="mt-2 text-[11.5px] text-ink-400">
                            {pol.visits_used} of {pol.visits_allowed} approved visits used
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------- chart */}
      {tab === "chart" ? (
        <Card padded={false}>
          <div className="flex items-center justify-between p-5 pb-3">
            <CardHeader
              title="Chart"
              subtitle={`${notes.length} notes · newest first`}
            />
            <LinkButton href={`${baseHref}&new=1`} variant="primary" size="sm">
              <FilePlus2 className="size-4" />
              New note
            </LinkButton>
          </div>
          {notes.length === 0 ? (
            <div className="p-5 pt-0">
              <EmptyState
                title="No chart notes yet"
                body="Start a note from a completed appointment, or create a standalone entry."
                icon={<FileText className="size-8" />}
              />
            </div>
          ) : (
            <ul className="divide-y divide-line-soft">
              {notes.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`${baseHref}&note=${n.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-brand-50/40"
                  >
                    <span className="w-24 shrink-0 text-[12.5px] text-ink-400 tabular-nums">
                      {fmtDateShort(n.created_at.slice(0, 10))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink-900">
                        {n.title}
                      </span>
                      <span className="block truncate text-[12px] text-ink-400">
                        {n.practitioner_name}
                        {n.credentials ? `, ${n.credentials}` : ""}
                        {n.template_name ? ` · ${n.template_name}` : ""}
                      </span>
                    </span>
                    {n.status === "signed" ? (
                      <Badge tone="good">
                        <Lock className="size-3" /> Signed
                      </Badge>
                    ) : (
                      <Badge tone="warn">Draft</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* ------------------------------------------------ appointments */}
      {tab === "appointments" ? (
        <Card padded={false}>
          <div className="p-5 pb-3">
            <CardHeader title="Appointment history" subtitle={`${appointments.length} in total`} />
          </div>
          {appointments.length === 0 ? (
            <div className="p-5 pt-0">
              <EmptyState title="No appointments yet" icon={<CalendarPlus className="size-8" />} />
            </div>
          ) : (
            <TableShell
              head={
                <>
                  <th className={th}>Date</th>
                  <th className={th}>Treatment</th>
                  <th className={th}>Practitioner</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Fee</th>
                  <th className={`${th} text-right`}>Note</th>
                </>
              }
            >
              {appointments.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-brand-50/30">
                  <td className={td}>
                    <Link href={`/schedule?date=${a.starts_at.slice(0, 10)}&appt=${a.id}`}>
                      <span className="block font-medium text-ink-900">
                        {fmtDateShort(a.starts_at.slice(0, 10))}
                      </span>
                      <span className="block text-[12px] text-ink-400">
                        {fmtTimeRange(a.starts_at, a.ends_at)}
                      </span>
                    </Link>
                  </td>
                  <td className={td}>{a.treatment_name}</td>
                  <td className={td}>{a.practitioner_name}</td>
                  <td className={td}>
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${APPOINTMENT_STATUS[a.status].chip}`}
                    >
                      {APPOINTMENT_STATUS[a.status].label}
                    </span>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{money(a.price_cents)}</td>
                  <td className={`${td} text-right`}>
                    {a.has_note ? (
                      <FileText className="ml-auto size-4 text-brand-500" aria-label="Charted" />
                    ) : a.status === "completed" ? (
                      <Link
                        href={`${baseHref}&new=1&appt=${a.id}`}
                        className="text-[12px] font-medium text-amber-700 hover:underline"
                      >
                        Add note
                      </Link>
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

      {/* ----------------------------------------------------- billing */}
      {tab === "billing" ? (
        <Card padded={false}>
          <div className="flex items-start justify-between p-5 pb-3">
            <CardHeader
              title="Invoices"
              subtitle={`${money(patient.balance_cents)} outstanding · ${money(lifetimeValue)} billed to date`}
            />
          </div>
          {invoices.length === 0 ? (
            <div className="p-5 pt-0">
              <EmptyState title="Nothing billed yet" icon={<Receipt className="size-8" />} />
            </div>
          ) : (
            <TableShell
              head={
                <>
                  <th className={th}>Invoice</th>
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

      {/* ---------------------------------------------- communications */}
      {tab === "messages" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" padded={false}>
            <div className="p-5 pb-3">
              <CardHeader title="Communication log" subtitle={`${comms.length} entries`} />
            </div>
            {comms.length === 0 ? (
              <div className="p-5 pt-0">
                <EmptyState title="Nothing logged yet" icon={<Mail className="size-8" />} />
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {comms.map((c) => (
                  <li key={c.id} className="flex gap-3 px-5 py-3">
                    <span className="mt-0.5 w-20 shrink-0 text-[12px] text-ink-400 tabular-nums">
                      {fmtDateShort(c.created_at)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-ink-900">
                          {c.subject || titleCase(c.kind)}
                        </span>
                        <Badge tone="neutral">{titleCase(c.kind)}</Badge>
                        {c.direction === "in" ? <Badge tone="brand">Inbound</Badge> : null}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-500">
                        {c.body}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-ink-300">{c.author}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Log an interaction" subtitle="Calls, emails and front-desk notes." />
            <div className="mt-3">
              <CommunicationForm patientId={patientId} />
            </div>
          </Card>
        </div>
      ) : null}

      {/* ------------------------------------------------------ modals */}
      {composing ? (
        <Dialog
          title="New chart note"
          subtitle={name}
          closeHref={baseHref}
          width="lg"
        >
          <ChartNoteEditor
            patientId={patientId}
            practitioners={practitioners}
            templates={templates}
            appointmentId={Number(pick("appt") ?? 0) || undefined}
            closeHref={baseHref}
          />
        </Dialog>
      ) : null}

      {openNote ? (
        <Dialog
          title={openNote.title}
          subtitle={`${openNote.practitioner_name}${openNote.credentials ? `, ${openNote.credentials}` : ""} · ${fmtDate(openNote.created_at.slice(0, 10))}`}
          closeHref={baseHref}
          width="lg"
        >
          {openNote.status === "signed" ? (
            <SignedNote
              note={openNote}
              templateFields={
                templates.find((t) => t.id === openNote.template_id)?.fields_json ?? "[]"
              }
            />
          ) : (
            <ChartNoteEditor
              patientId={patientId}
              practitioners={practitioners}
              templates={templates}
              note={openNote}
              closeHref={baseHref}
            />
          )}
        </Dialog>
      ) : null}

      {editingPolicy ? (
        <Dialog
          title={editingPolicy === "new" ? "Add insurance policy" : "Edit insurance policy"}
          subtitle={name}
          closeHref={baseHref}
          width="md"
        >
          <PolicyForm
            patientId={patientId}
            policy={
              editingPolicy === "new"
                ? undefined
                : policies.find((p) => p.id === Number(editingPolicy))
            }
          />
        </Dialog>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */

function MiniStat({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "muted" | "brand" | "danger";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
      <p className="text-[11.5px] font-medium tracking-wide text-ink-400 uppercase">{label}</p>
      <p
        className={clsx(
          "mt-1 text-[17px] font-semibold tracking-tight",
          tone === "danger" ? "text-rose-600" : tone === "brand" ? "text-brand-700" : "text-ink-900",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-[11.5px] text-ink-400">{hint}</p> : null}
    </div>
  );
}

function SignedNote({
  note,
  templateFields,
}: {
  note: { id: number; body_json: string; signed_at: string; practitioner_name: string; credentials: string };
  templateFields: string;
}) {
  let fields: ChartField[] = [];
  let body: Record<string, string> = {};
  try {
    fields = JSON.parse(templateFields) as ChartField[];
  } catch {
    fields = [];
  }
  try {
    body = JSON.parse(note.body_json) as Record<string, string>;
  } catch {
    body = {};
  }

  const known = new Set(fields.map((f) => f.key));
  const extras = Object.keys(body).filter((k) => !known.has(k) && k !== "addendum");

  return (
    <div>
      <p className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
        <Lock className="size-3.5" />
        Signed by {note.practitioner_name}
        {note.credentials ? `, ${note.credentials}` : ""} on{" "}
        {fmtDate(note.signed_at.slice(0, 10))}. This note is locked.
      </p>

      <dl className="space-y-4">
        {fields.map((f) => {
          const v = body[f.key];
          if (!v) return null;
          return (
            <div key={f.key}>
              <dt className="text-[11.5px] font-semibold tracking-wide text-ink-400 uppercase">
                {f.label}
              </dt>
              <dd className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-900">
                {f.type === "checkbox" ? (v === "yes" ? "Yes" : "No") : v}
              </dd>
            </div>
          );
        })}
        {extras.map((k) => (
          <div key={k}>
            <dt className="text-[11.5px] font-semibold tracking-wide text-ink-400 uppercase">{k}</dt>
            <dd className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-900">
              {body[k]}
            </dd>
          </div>
        ))}
        {body.addendum ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <dt className="text-[11.5px] font-semibold tracking-wide text-amber-800 uppercase">
              Addenda
            </dt>
            <dd className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-900">
              {body.addendum}
            </dd>
          </div>
        ) : null}
      </dl>

      <AddendumForm noteId={note.id} />
    </div>
  );
}
