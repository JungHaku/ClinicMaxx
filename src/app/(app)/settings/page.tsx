import Link from "next/link";
import clsx from "clsx";
import { Globe, MapPin, Plus } from "lucide-react";
import { Badge, Card, CardHeader, LinkButton, PageHeader, TableShell, td, th } from "@/components/ui";
import { Dialog } from "@/components/Dialog";
import {
  ClinicForm,
  LocationForm,
  PractitionerForm,
  ProductForm,
  TreatmentForm,
} from "@/components/settings/SettingsForms";
import {
  getClinic,
  listAvailability,
  listChartTemplates,
  listDisciplines,
  listLocations,
  listPractitioners,
  listProducts,
  listTreatments,
} from "@/lib/queries";
import { duration, money } from "@/lib/format";
import { colorSet } from "@/lib/colors";
import type { ChartField } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

type Search = Promise<Record<string, string | string[] | undefined>>;

const TABS = [
  ["clinic", "Clinic"],
  ["treatments", "Treatments"],
  ["staff", "Practitioners"],
  ["products", "Products"],
  ["locations", "Locations"],
  ["templates", "Chart templates"],
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) as string | undefined;

  const tab = (pick("tab") ?? "clinic") as (typeof TABS)[number][0];
  const edit = pick("edit");

  const clinic = getClinic();
  const disciplines = listDisciplines();
  const locations = listLocations();
  const treatments = listTreatments(false);
  const practitioners = listPractitioners();
  const products = listProducts();
  const templates = listChartTemplates();

  const baseHref = `/settings?tab=${tab}`;
  const editingTreatment =
    tab === "treatments" && edit ? treatments.find((t) => t.id === Number(edit)) : undefined;
  const editingPractitioner =
    tab === "staff" && edit ? practitioners.find((p) => p.id === Number(edit)) : undefined;
  const editingProduct =
    tab === "products" && edit ? products.find((p) => p.id === Number(edit)) : undefined;
  const editingLocation =
    tab === "locations" && edit ? locations.find((l) => l.id === Number(edit)) : undefined;

  return (
    <>
      <PageHeader title="Settings" subtitle="How the clinic runs — the bits behind the calendar." />

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/settings?tab=${key}`}
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

      {/* ------------------------------------------------------ clinic */}
      {tab === "clinic" ? (
        <Card className="max-w-3xl">
          <CardHeader
            title="Clinic profile"
            subtitle="Appears on receipts, the booking page and reminder emails."
          />
          <div className="mt-4">
            <ClinicForm clinic={clinic} />
          </div>
        </Card>
      ) : null}

      {/* -------------------------------------------------- treatments */}
      {tab === "treatments" ? (
        <Card padded={false}>
          <div className="flex items-center justify-between p-5 pb-3">
            <CardHeader
              title="Treatments"
              subtitle={`${treatments.filter((t) => t.is_active).length} active of ${treatments.length}`}
            />
            <LinkButton href={`${baseHref}&edit=new`} variant="primary" size="sm">
              <Plus className="size-4" />
              New treatment
            </LinkButton>
          </div>
          <TableShell
            head={
              <>
                <th className={th}>Treatment</th>
                <th className={th}>Discipline</th>
                <th className={`${th} text-right`}>Duration</th>
                <th className={`${th} text-right`}>Price</th>
                <th className={th}>Online</th>
                <th className={`${th} text-right`} />
              </>
            }
          >
            {treatments.map((t) => {
              const d = disciplines.find((x) => x.id === t.discipline_id);
              return (
                <tr key={t.id} className={clsx(!t.is_active && "opacity-50")}>
                  <td className={td}>
                    <span className="font-medium text-ink-900">{t.name}</span>
                    {t.description ? (
                      <span className="block max-w-md truncate text-[12px] text-ink-400">
                        {t.description}
                      </span>
                    ) : null}
                  </td>
                  <td className={td}>
                    {d ? <Badge className={colorSet(d.color).soft}>{d.name}</Badge> : "—"}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{duration(t.duration_min)}</td>
                  <td className={`${td} text-right font-medium tabular-nums`}>
                    {money(t.price_cents)}
                  </td>
                  <td className={td}>
                    {t.online_bookable ? (
                      <Globe className="size-4 text-brand-500" aria-label="Bookable online" />
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <Link
                      href={`${baseHref}&edit=${t.id}`}
                      className="text-[12.5px] font-medium text-brand-700 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </TableShell>
        </Card>
      ) : null}

      {/* ------------------------------------------------------- staff */}
      {tab === "staff" ? (
        <Card padded={false}>
          <div className="flex items-center justify-between p-5 pb-3">
            <CardHeader title="Practitioners" subtitle={`${practitioners.length} on the team`} />
            <LinkButton href={`${baseHref}&edit=new`} variant="primary" size="sm">
              <Plus className="size-4" />
              Add practitioner
            </LinkButton>
          </div>
          <TableShell
            head={
              <>
                <th className={th}>Name</th>
                <th className={th}>Discipline</th>
                <th className={th}>Role</th>
                <th className={th}>Location</th>
                <th className={th}>Online booking</th>
                <th className={`${th} text-right`} />
              </>
            }
          >
            {practitioners.map((p) => (
              <tr key={p.id}>
                <td className={td}>
                  <span className="flex items-center gap-2">
                    <span className={clsx("size-2.5 rounded-full", colorSet(p.color).bar)} />
                    <span className="font-medium text-ink-900">
                      {p.first_name} {p.last_name}
                    </span>
                    {p.credentials ? (
                      <span className="text-[12px] text-ink-400">{p.credentials}</span>
                    ) : null}
                  </span>
                </td>
                <td className={td}>{p.discipline}</td>
                <td className={`${td} capitalize`}>{p.role}</td>
                <td className={td}>
                  {locations.find((l) => l.id === p.location_id)?.name ?? "—"}
                </td>
                <td className={td}>
                  {p.online_booking ? (
                    <Badge tone="good">On</Badge>
                  ) : (
                    <Badge tone="neutral">Off</Badge>
                  )}
                </td>
                <td className={`${td} text-right`}>
                  <Link
                    href={`${baseHref}&edit=${p.id}`}
                    className="text-[12.5px] font-medium text-brand-700 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>
      ) : null}

      {/* ---------------------------------------------------- products */}
      {tab === "products" ? (
        <Card padded={false}>
          <div className="flex items-center justify-between p-5 pb-3">
            <CardHeader title="Retail products" subtitle="Sold at checkout and added to invoices." />
            <LinkButton href={`${baseHref}&edit=new`} variant="primary" size="sm">
              <Plus className="size-4" />
              New product
            </LinkButton>
          </div>
          <TableShell
            head={
              <>
                <th className={th}>Product</th>
                <th className={th}>SKU</th>
                <th className={`${th} text-right`}>Cost</th>
                <th className={`${th} text-right`}>Price</th>
                <th className={`${th} text-right`}>Margin</th>
                <th className={`${th} text-right`}>Stock</th>
                <th className={`${th} text-right`} />
              </>
            }
          >
            {products.map((p) => (
              <tr key={p.id}>
                <td className={`${td} font-medium text-ink-900`}>{p.name}</td>
                <td className={`${td} text-ink-400`}>{p.sku || "—"}</td>
                <td className={`${td} text-right tabular-nums`}>{money(p.cost_cents)}</td>
                <td className={`${td} text-right tabular-nums`}>{money(p.price_cents)}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {p.price_cents > 0
                    ? `${Math.round(((p.price_cents - p.cost_cents) / p.price_cents) * 100)}%`
                    : "—"}
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  {p.stock <= 5 ? (
                    <span className="font-semibold text-amber-700">{p.stock}</span>
                  ) : (
                    p.stock
                  )}
                </td>
                <td className={`${td} text-right`}>
                  <Link
                    href={`${baseHref}&edit=${p.id}`}
                    className="text-[12.5px] font-medium text-brand-700 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>
      ) : null}

      {/* --------------------------------------------------- locations */}
      {tab === "locations" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <LinkButton href={`${baseHref}&edit=new`} variant="primary" size="sm">
              <Plus className="size-4" />
              New location
            </LinkButton>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {locations.map((l) => (
              <Card key={l.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
                      <MapPin className="size-4 text-brand-500" />
                      {l.name}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-500">
                      {l.address}
                      <br />
                      {l.city} {l.region} {l.postal_code}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-400">{l.phone}</p>
                  </div>
                  <Link
                    href={`${baseHref}&edit=${l.id}`}
                    className="text-[12.5px] font-medium text-brand-700 hover:underline"
                  >
                    Edit
                  </Link>
                </div>
                <p className="mt-3 border-t border-line-soft pt-3 text-[12.5px] text-ink-400">
                  {practitioners.filter((p) => p.location_id === l.id).length} practitioners based here
                </p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------- templates */}
      {tab === "templates" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => {
            let fields: ChartField[] = [];
            try {
              fields = JSON.parse(t.fields_json) as ChartField[];
            } catch {
              fields = [];
            }
            const d = disciplines.find((x) => x.id === t.discipline_id);
            return (
              <Card key={t.id}>
                <CardHeader
                  title={t.name}
                  subtitle={`${fields.length} fields · ${t.kind}`}
                  action={d ? <Badge className={colorSet(d.color).soft}>{d.name}</Badge> : null}
                />
                <ul className="mt-3 space-y-1.5">
                  {fields.map((f) => (
                    <li key={f.key} className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] text-ink-900">{f.label}</span>
                      <span className="shrink-0 text-[11.5px] text-ink-300">{f.type}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* ------------------------------------------------------ modals */}
      {tab === "treatments" && edit ? (
        <Dialog
          title={editingTreatment ? "Edit treatment" : "New treatment"}
          closeHref={baseHref}
          width="md"
        >
          <TreatmentForm
            treatment={editingTreatment}
            disciplines={disciplines}
            closeHref={baseHref}
          />
        </Dialog>
      ) : null}

      {tab === "staff" && edit ? (
        <Dialog
          title={editingPractitioner ? "Edit practitioner" : "Add practitioner"}
          closeHref={baseHref}
          width="lg"
        >
          <PractitionerForm
            practitioner={editingPractitioner}
            disciplines={disciplines}
            locations={locations}
            availability={
              editingPractitioner ? listAvailability(editingPractitioner.id) : undefined
            }
            closeHref={baseHref}
          />
        </Dialog>
      ) : null}

      {tab === "products" && edit ? (
        <Dialog
          title={editingProduct ? "Edit product" : "New product"}
          closeHref={baseHref}
          width="md"
        >
          <ProductForm product={editingProduct} closeHref={baseHref} />
        </Dialog>
      ) : null}

      {tab === "locations" && edit ? (
        <Dialog
          title={editingLocation ? "Edit location" : "New location"}
          closeHref={baseHref}
          width="md"
        >
          <LocationForm location={editingLocation} closeHref={baseHref} />
        </Dialog>
      ) : null}
    </>
  );
}
