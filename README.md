# ClinicMaxx

Practice management and clinic CRM for multi-disciplinary allied-health clinics —
scheduling, charting, billing, insurance and online booking in one place. Built as
a working clone of the Jane app's core product.

Everything runs locally against a SQLite file. No accounts, no cloud services, no
API keys.

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. The first launch creates `data/clinicmaxx.db`
and seeds a full demo clinic — 480 clients, 9 staff, ~6,000 appointments spanning
five months of history and a month of forward bookings, with matching invoices,
payments, insurance claims and chart notes.

### Or just double-click it

```bash
./scripts/make-app.sh
```

That builds **ClinicMaxx.app** on the Desktop — an icon plus a launcher that
starts the server and opens the browser for you. It reuses an already-running
ClinicMaxx if it finds one, picks the first free port in 3000–3010 otherwise, and
stops the server again when you quit the app.

The launcher deliberately assumes nothing about the environment: a double-clicked
`.app` inherits a bare `/usr/bin:/bin` rather than your login shell's `PATH`, so it
searches the usual Homebrew, MacPorts, Volta, nvm and fnm locations for Node and
shows a real dialog if it can't find one. Re-run `make-app.sh` if you move the
project folder — the path is baked into the bundle.

The icon lives at [`assets/icon.svg`](assets/icon.svg). Edit it and re-run the
script to regenerate the whole `.icns` (every size from 16px to 1024px, 1× and
2×) — `sips` rasterises the SVG, so there is nothing to install.

## What's in it

| Area | What it does |
|---|---|
| **Dashboard** | Today's roster, chair utilisation, month-to-date revenue against last month, outstanding balances, insurer float, unsigned notes, task list |
| **Schedule** | Day and week calendar, one column per practitioner, working-hours shading, a live now-line, click-any-slot booking, side-by-side overlap layout, check-in → check-out → invoice |
| **Clients** | Searchable roster, full profile, insurance policies with annual-max tracking, appointment history, billing history, communication log |
| **Charting** | Discipline-specific note templates (SOAP, massage record, TCM, counselling, intake, discharge). Notes sign and lock; corrections go in as timestamped addenda |
| **Billing** | Invoices with line items and retail products, payments in five methods, insurer claims with adjudication, aged receivables |
| **Reports** | Payments over time, billings by practitioner and discipline, attendance, online-vs-desk booking split, retention cohorts, insurer performance, referral sources |
| **Online booking** | Public four-step wizard at `/book` — service → practitioner → real open slot → details. Matches returning clients by email, creates new ones, and lands straight on the clinic calendar |
| **Settings** | Clinic profile, treatments and pricing, practitioners and their weekly hours, retail stock, locations, chart templates |

## How it's built

- **Next.js 16** (App Router) with React Server Components. Pages read the
  database directly; mutations are Server Actions. There is no API layer to keep
  in sync — the one route handler that exists (`/api/search`) backs the
  type-ahead, which genuinely needs to be incremental.
- **SQLite via `node:sqlite`** — Node's built-in driver, so `npm install` compiles
  nothing. The schema lives in [`src/lib/schema.ts`](src/lib/schema.ts).
- **Tailwind CSS v4** with the design tokens in
  [`src/app/globals.css`](src/app/globals.css).
- **Zero client state libraries.** Dialogs, filters, tabs and the calendar's
  date/view all live in the URL, which is what lets the contents be
  server-rendered and makes every view linkable.

### Layout

```
assets/
  icon.svg        the app icon — edit this, then re-run scripts/make-app.sh
scripts/
  make-app.sh     builds ClinicMaxx.app (icon + launcher) onto the Desktop
  launcher.sh     what lives inside the bundle and starts the server
  seed.ts         standalone seeder
src/
  app/
    (app)/          the signed-in clinic app behind the sidebar shell
    book/           the public booking page — no sidebar, own chrome
    api/search/     type-ahead for the client picker
  components/
    schedule/       calendar grid, toolbar, booking form, appointment actions
    chart/          note editor and addendum form
    billing/        payment, line-item, claim and print controls
    booking/        the public wizard
    settings/       the settings forms
    charts.tsx      SVG chart primitives
    ui.tsx          buttons, cards, badges, tables, meters
  lib/
    schema.ts       the database
    seed.ts         the demo clinic generator (deterministic)
    queries.ts      every read
    actions.ts      every write
    availability.ts open-slot computation for online booking
```

### Money, time and other things that are easy to get wrong

- **Money is integer cents everywhere.** Tax rates are basis points (`1250` =
  12.5%). Nothing is stored as a float.
- **Appointment times are local wall-clock strings** (`2026-07-27T14:30`). They
  sort lexicographically, and a clinic's calendar never shifts underneath it
  because a server changed timezone.
- **Invoice totals are always recomputed** from line items and payments rather
  than incremented, so they cannot drift.
- **Double bookings are rejected** by an overlap check inside the booking action,
  not just hidden in the UI — the public wizard and the staff dialog both go
  through it.
- **Signed notes are immutable.** The save action refuses to rewrite one; the only
  way forward is an addendum.

### Charts

Chart colour follows the rules in the bundled data-viz guidance: magnitude is
encoded with a single hue and identity comes from the row label, so no
categorical palette has to survive a colour-vision check. The one place fixed
status colours appear (attendance) always ships the label and the count beside
the swatch, and every chart offers a data table.

## Commands

```bash
npm run dev        # start the app (seeds the database on first run)
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run db:seed    # seed an empty database
npm run db:reset   # delete and rebuild the demo clinic
```

Set `CLINICMAXX_DB` to point at a different SQLite file.

## Known limits

This is a product demo, not a deployed medical record system. In particular:

- **There is no authentication.** Every visitor is the practice manager. Real
  clinical software needs per-user accounts, role-based access to charts, and an
  audit trail tied to a real identity — the `audit_log` table is written but
  nothing reads from it yet.
- Emails and SMS are *logged*, not sent.
- Insurance adjudication is simulated locally; there is no clearing-house
  integration.
- Payments are recorded, not processed — no card is ever charged.
- Clinical records here are demo data and are not protected to any health-privacy
  standard (PIPEDA, HIPAA). Don't put real patient information in it.
