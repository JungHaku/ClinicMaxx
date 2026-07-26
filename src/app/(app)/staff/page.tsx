import Link from "next/link";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { Avatar, Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { colorSet } from "@/lib/colors";
import {
  listAvailability,
  listDisciplines,
  listLocations,
  listPractitioners,
  treatmentsFor,
} from "@/lib/queries";
import { all } from "@/lib/db";
import { fmtTime, money } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff" };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StaffPage() {
  const practitioners = listPractitioners();
  const disciplines = listDisciplines();
  const locations = listLocations();

  const weekLoad = all<{ practitioner_id: number; n: number }>(
    `SELECT practitioner_id, COUNT(*) AS n FROM appointments
      WHERE status IN ('booked','arrived','completed')
        AND starts_at >= date('now','-7 day') || 'T00:00'
      GROUP BY practitioner_id`,
  );
  const loadMap = new Map(weekLoad.map((r) => [r.practitioner_id, r.n]));

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={`${practitioners.length} people across ${disciplines.length - 1} disciplines`}
        actions={
          <LinkButton href="/settings?tab=staff" variant="primary" size="sm">
            Add practitioner
          </LinkButton>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {practitioners.map((p) => {
          const name = `${p.first_name} ${p.last_name}`;
          const hours = listAvailability(p.id);
          const treatments = treatmentsFor(p.id);
          const location = locations.find((l) => l.id === p.location_id);
          const c = colorSet(p.color);

          return (
            <Card key={p.id} padded={false} className="overflow-hidden">
              <div className={`h-1 ${c.bar}`} />
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={name} color={p.color} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink-900">{name}</p>
                    <p className="text-[12.5px] text-ink-400">
                      {p.credentials || p.discipline}
                    </p>
                  </div>
                  {p.role !== "practitioner" ? (
                    <Badge tone="neutral" className="capitalize">
                      {p.role}
                    </Badge>
                  ) : null}
                </div>

                {p.bio ? (
                  <p className="mt-3 text-[12.5px] leading-relaxed text-ink-500">{p.bio}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge className={c.soft}>{p.discipline}</Badge>
                  {p.online_booking ? (
                    <Badge tone="good">
                      <Globe className="size-3" /> Online booking on
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Internal only</Badge>
                  )}
                </div>

                <dl className="mt-4 space-y-1.5 text-[12.5px]">
                  {p.email ? (
                    <div className="flex items-center gap-2 text-ink-500">
                      <Mail className="size-3.5 shrink-0 text-ink-300" />
                      <a href={`mailto:${p.email}`} className="truncate hover:text-brand-700">
                        {p.email}
                      </a>
                    </div>
                  ) : null}
                  {p.phone ? (
                    <div className="flex items-center gap-2 text-ink-500">
                      <Phone className="size-3.5 shrink-0 text-ink-300" />
                      {p.phone}
                    </div>
                  ) : null}
                  {location ? (
                    <div className="flex items-center gap-2 text-ink-500">
                      <MapPin className="size-3.5 shrink-0 text-ink-300" />
                      {location.name}
                    </div>
                  ) : null}
                </dl>

                {hours.length ? (
                  <div className="mt-4 border-t border-line-soft pt-3">
                    <p className="mb-2 text-[11.5px] font-semibold tracking-wide text-ink-400 uppercase">
                      Working hours
                    </p>
                    <ul className="space-y-0.5">
                      {hours.map((h) => (
                        <li key={h.id} className="flex justify-between text-[12px]">
                          <span className="text-ink-500">{DAY_LABELS[h.weekday]}</span>
                          <span className="text-ink-900 tabular-nums">
                            {fmtTime(h.start_min)} – {fmtTime(h.end_min)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
                  <div>
                    <p className="text-[11.5px] text-ink-400">Last 7 days</p>
                    <p className="text-[15px] font-semibold text-ink-900 tabular-nums">
                      {loadMap.get(p.id) ?? 0} <span className="text-[12px] font-normal text-ink-400">visits</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11.5px] text-ink-400">Offers</p>
                    <p className="text-[15px] font-semibold text-ink-900 tabular-nums">
                      {treatments.length}{" "}
                      <span className="text-[12px] font-normal text-ink-400">treatments</span>
                    </p>
                  </div>
                </div>

                {treatments.length ? (
                  <details className="group mt-3">
                    <summary className="cursor-pointer list-none text-[12px] font-medium text-brand-700">
                      <span className="group-open:hidden">Show treatment list</span>
                      <span className="hidden group-open:inline">Hide treatment list</span>
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {treatments.map((t) => (
                        <li key={t.id} className="flex justify-between text-[12px]">
                          <span className="truncate text-ink-500">{t.name}</span>
                          <span className="shrink-0 text-ink-900 tabular-nums">
                            {money(t.price_cents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/schedule?prac=${p.id}`}
                    className="flex-1 rounded-lg border border-line px-3 py-1.5 text-center text-[12.5px] font-medium text-ink-700 transition-colors hover:bg-brand-50"
                  >
                    View schedule
                  </Link>
                  <Link
                    href={`/settings?tab=staff&edit=${p.id}`}
                    className="flex-1 rounded-lg border border-line px-3 py-1.5 text-center text-[12.5px] font-medium text-ink-700 transition-colors hover:bg-brand-50"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
