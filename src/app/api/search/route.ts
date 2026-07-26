import { NextResponse } from "next/server";
import { searchPatients } from "@/lib/queries";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ patients: [] });

  const patients = searchPatients(q, 8).map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`,
    email: p.email,
    phone: p.phone,
    dob: p.date_of_birth ? fmtDate(p.date_of_birth) : "",
  }));

  return NextResponse.json({ patients });
}
