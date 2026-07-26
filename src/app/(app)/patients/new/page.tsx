import { BackLink } from "@/components/Sidebar";
import { PageHeader } from "@/components/ui";
import { PatientForm } from "@/components/PatientForm";

export const metadata = { title: "New client" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function NewPatientPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const name = (Array.isArray(sp.name) ? sp.name[0] : sp.name) ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href="/patients">All clients</BackLink>
      <PageHeader
        title="New client"
        subtitle="Only a name is required — the rest can be filled in at the first visit."
      />
      <PatientForm defaultName={name} />
    </div>
  );
}
