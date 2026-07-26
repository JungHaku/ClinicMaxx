import { BookingWizard } from "@/components/booking/BookingWizard";
import { openSlots, todayForBooking } from "@/lib/availability";
import {
  getClinic,
  listDisciplines,
  listLocations,
  listPractitioners,
  listTreatments,
} from "@/lib/queries";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Book an appointment",
  description: "Choose a service, a practitioner and a time that suits you.",
};

export default function BookPage() {
  const clinic = getClinic();
  const locations = listLocations();
  const disciplines = listDisciplines();
  const practitioners = listPractitioners({ bookableOnly: true });
  const treatments = listTreatments().filter((t) => t.online_bookable);

  const links = all<{ practitioner_id: number; treatment_id: number }>(
    "SELECT practitioner_id, treatment_id FROM practitioner_treatments",
  );

  const today = todayForBooking();

  // Precompute openings for every practitioner/treatment pair that is actually
  // offered, so the wizard can move between steps without a round trip.
  const availability: Record<string, ReturnType<typeof openSlots>> = {};
  for (const t of treatments) {
    for (const p of practitioners) {
      if (!links.some((l) => l.practitioner_id === p.id && l.treatment_id === t.id)) continue;
      availability[`${p.id}:${t.id}`] = openSlots({
        practitionerId: p.id,
        durationMin: t.duration_min,
        fromDate: today,
        days: 21,
        leadHours: clinic.booking_lead_hours,
      });
    }
  }

  const usedDisciplines = disciplines.filter((d) =>
    treatments.some((t) => t.discipline_id === d.id),
  );

  return (
    <BookingWizard
      clinic={{
        name: clinic.name,
        tagline: clinic.tagline,
        phone: clinic.phone,
        email: clinic.email,
        cancellationHours: clinic.cancellation_hours,
      }}
      locations={locations.map((l) => ({
        id: l.id,
        name: l.name,
        address: `${l.address}, ${l.city} ${l.region}`,
      }))}
      disciplines={usedDisciplines.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        color: d.color,
      }))}
      treatments={treatments.map((t) => ({
        id: t.id,
        name: t.name,
        disciplineId: t.discipline_id,
        durationMin: t.duration_min,
        priceCents: t.price_cents,
        description: t.description,
      }))}
      practitioners={practitioners.map((p) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        credentials: p.credentials,
        bio: p.bio,
        color: p.color,
        disciplineId: p.discipline_id,
        locationId: p.location_id,
        treatmentIds: links.filter((l) => l.practitioner_id === p.id).map((l) => l.treatment_id),
      }))}
      availability={availability}
    />
  );
}
