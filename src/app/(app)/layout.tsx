import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { getClinic, listTasks } from "@/lib/queries";
import { fmtDateLong, todayKey } from "@/lib/format";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const clinic = getClinic();
  const openTasks = listTasks("open").length;

  return (
    <div className="flex min-h-dvh">
      <Sidebar clinicName={clinic.name} openTasks={openTasks} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar today={fmtDateLong(todayKey())} />
        <main className="flex-1 px-4 py-5 lg:px-7 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
