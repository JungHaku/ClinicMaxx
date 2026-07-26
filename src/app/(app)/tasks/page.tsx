import Link from "next/link";
import clsx from "clsx";
import { ListChecks } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { TaskRow } from "@/components/TaskRow";
import { TaskForm } from "@/components/TaskForm";
import { listPractitioners, listTasks } from "@/lib/queries";
import { todayKey } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks" };

type Search = Promise<Record<string, string | string[] | undefined>>;

const FILTERS = [
  ["open", "Open"],
  ["done", "Done"],
  ["all", "All"],
] as const;

export default async function TasksPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const filter = ((Array.isArray(sp.status) ? sp.status[0] : sp.status) ?? "open") as string;

  const tasks = listTasks(filter);
  const practitioners = listPractitioners();
  const today = todayKey();

  const overdue = tasks.filter((t) => t.status === "open" && t.due_on && t.due_on < today);
  const dueToday = tasks.filter((t) => t.status === "open" && t.due_on === today);
  const later = tasks.filter(
    (t) => !overdue.includes(t) && !dueToday.includes(t),
  );

  const groups: Array<[string, typeof tasks]> = [
    ["Overdue", overdue],
    ["Due today", dueToday],
    [filter === "done" ? "Completed" : "Later", later],
  ];

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Front-desk follow-ups that don't belong on the calendar."
        actions={
          <div className="flex items-center rounded-lg border border-line bg-surface p-0.5 shadow-card">
            {FILTERS.map(([key, label]) => (
              <Link
                key={key}
                href={`/tasks?status=${key}`}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  filter === key ? "bg-brand-600 text-white" : "text-ink-500 hover:text-ink-900",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {tasks.length === 0 ? (
            <Card>
              <EmptyState
                title={filter === "open" ? "Nothing outstanding" : "No tasks here"}
                body="Anything you add lands on the dashboard too."
                icon={<ListChecks className="size-8" />}
              />
            </Card>
          ) : (
            groups.map(([label, group]) =>
              group.length ? (
                <Card key={label}>
                  <CardHeader
                    title={label}
                    subtitle={`${group.length} ${group.length === 1 ? "task" : "tasks"}`}
                  />
                  <ul className="mt-3 space-y-3">
                    {group.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </ul>
                </Card>
              ) : null,
            )
          )}
        </div>

        <Card className="h-fit">
          <CardHeader title="Add a task" />
          <div className="mt-3">
            <TaskForm practitioners={practitioners} />
          </div>
        </Card>
      </div>
    </>
  );
}
