# Clinic data exports

Drop Jane appointment exports here. **Everything in this folder is gitignored
except this file**, so nothing you put here can be committed by accident.

That matters because this repository is public and a real export is patient
data: `patient_guid`, `patient_number`, full names and preferred names,
`chart_status`, `notes_text`, and the cancellation reasons attached to each
visit.

## Getting an export out of Jane

Reports → Appointments → set the date range → Export CSV. Files arrive named
`Clinic_Appointments_Start_End_ExportedBy.csv`.

## The shape of the file

26 columns. Most map onto ClinicMaxx's own tables:

| Jane column | ClinicMaxx |
|---|---|
| `start_at`, `end_at` | `appointments.starts_at`, `ends_at` |
| `state` | `appointments.status` |
| `booked_online` | `appointments.source` |
| `first_visit` | `appointments.is_first_visit` |
| `cancelled_reason` | `appointments.cancel_reason` |
| `notes_text` | `appointments.notes` |
| `treatment_name` | `treatments.name` |
| `staff_member_name` | `practitioners.first_name` + `last_name` |
| `location_name` | `locations.name` |
| `patient_*` | `patients.*` |
| `chart_status` | `chart_notes.status` |
| `referral_source` | `patients.referral_source` |

Four columns have no home yet, and they are the interesting ones:

- `arrived_at`, `no_show_at`, `cancelled_at`, `archived_at` — Jane keeps a
  timestamp per transition; ClinicMaxx collapses all of it into a single
  `status`, so questions like "how long between booking and arrival?" cannot be
  answered today.
- `break` — Jane books breaks as calendar entries. ClinicMaxx has no such concept.
- `patient_guid` / `patient_number` — no external-id column on `patients`, which
  is what a re-import would need in order to match rather than duplicate.
- `insurance_state` — per-appointment, where ClinicMaxx tracks state per claim.

## If you commit one on purpose

You will need to force it, which is the point:

```bash
git add -f csvs/some-fixture.csv
```

Only do that with fabricated data.
