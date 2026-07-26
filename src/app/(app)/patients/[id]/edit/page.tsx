import { notFound } from "next/navigation";
import { BackLink } from "@/components/Sidebar";
import { PageHeader } from "@/components/ui";
import { PatientForm } from "@/components/PatientForm";
import { ArchivePatientButton } from "@/components/patient/ArchivePatientButton";
import { getPatient } from "@/lib/queries";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const p = getPatient(Number(id));
  return { title: p ? `Edit ${p.first_name} ${p.last_name}` : "Edit client" };
}

export default async function EditPatientPage({ params }: { params: Params }) {
  const { id } = await params;
  const patient = getPatient(Number(id));
  if (!patient) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href={`/patients/${patient.id}`}>
        {patient.first_name} {patient.last_name}
      </BackLink>
      <PageHeader
        title="Edit client"
        subtitle="Changes apply everywhere this client appears."
        actions={<ArchivePatientButton patientId={patient.id} />}
      />
      <PatientForm patient={patient} />
    </div>
  );
}
