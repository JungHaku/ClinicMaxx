import Link from "next/link";
import { Search, UserPlus, Users } from "lucide-react";
import { Avatar, Badge, Card, EmptyState, LinkButton, PageHeader, TableShell, td, th } from "@/components/ui";
import { countPatients, searchPatients } from "@/lib/queries";
import { age, fmtDateShort, money, relativeDay } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

type Search = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 40;

export default async function PatientsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);

  const total = countPatients(q);
  const patients = searchPatients(q, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${total.toLocaleString()} active ${total === 1 ? "client" : "clients"}`}
        actions={
          <LinkButton href="/patients/new" variant="primary" size="sm">
            <UserPlus className="size-4" />
            New client
          </LinkButton>
        }
      />

      <Card padded={false}>
        <form className="border-b border-line p-3" action="/patients">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-300" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name, email, phone or tag…"
              className="w-full rounded-lg border border-line bg-canvas py-2 pr-3 pl-9 text-[13.5px] text-ink-900 placeholder:text-ink-300 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
          </div>
        </form>

        {patients.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={q ? `No client matches “${q}”` : "No clients yet"}
              body={
                q
                  ? "Try a partial last name, or the digits of their phone number."
                  : "Add your first client to start booking."
              }
              icon={<Users className="size-8" />}
              action={
                <LinkButton href="/patients/new" variant="primary" size="sm">
                  New client
                </LinkButton>
              }
            />
          </div>
        ) : (
          <TableShell
            head={
              <>
                <th className={th}>Client</th>
                <th className={th}>Contact</th>
                <th className={th}>Last visit</th>
                <th className={th}>Next visit</th>
                <th className={`${th} text-right`}>Visits</th>
                <th className={`${th} text-right`}>Balance</th>
              </>
            }
          >
            {patients.map((p) => {
              const name = `${p.first_name} ${p.last_name}`;
              const tags = p.tags ? p.tags.split(",").filter(Boolean) : [];
              const years = age(p.date_of_birth);
              return (
                <tr key={p.id} className="transition-colors hover:bg-brand-50/40">
                  <td className={td}>
                    <Link href={`/patients/${p.id}`} className="flex items-center gap-2.5">
                      <Avatar name={name} size="sm" color="slate" />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-ink-900">{name}</span>
                          {tags.slice(0, 2).map((t) => (
                            <Badge key={t} tone={t === "New client" ? "brand" : "neutral"}>
                              {t}
                            </Badge>
                          ))}
                        </span>
                        <span className="block text-[12px] text-ink-400">
                          {years !== null ? `${years} yrs` : "DOB not recorded"}
                          {p.pronouns ? ` · ${p.pronouns}` : ""}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className={td}>
                    <span className="block truncate text-[13px] text-ink-700">{p.email || "—"}</span>
                    <span className="block text-[12px] text-ink-400">{p.phone}</span>
                  </td>
                  <td className={td}>
                    {p.last_visit ? (
                      <>
                        <span className="block">{fmtDateShort(p.last_visit.slice(0, 10))}</span>
                        <span className="block text-[12px] text-ink-400">
                          {relativeDay(p.last_visit.slice(0, 10))}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-300">Never</span>
                    )}
                  </td>
                  <td className={td}>
                    {p.next_visit ? (
                      <span className="font-medium text-brand-700">
                        {fmtDateShort(p.next_visit.slice(0, 10))}
                      </span>
                    ) : (
                      <span className="text-ink-300">Not booked</span>
                    )}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{p.visit_count}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {p.balance_cents > 0 ? (
                      <span className="font-semibold text-rose-600">{money(p.balance_cents)}</span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </TableShell>
        )}

        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px]">
            <span className="text-ink-400">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/patients?q=${encodeURIComponent(q)}&page=${page - 1}`}
                  className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink-700 hover:bg-brand-50"
                >
                  Previous
                </Link>
              ) : null}
              {page < pages ? (
                <Link
                  href={`/patients?q=${encodeURIComponent(q)}&page=${page + 1}`}
                  className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink-700 hover:bg-brand-50"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>
    </>
  );
}
