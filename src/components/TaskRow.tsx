"use client";

import Link from "next/link";
import { useActionState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { toggleTask } from "@/lib/actions";
import { fmtDateShort, relativeDay, todayKey } from "@/lib/format";
import type { TaskView } from "@/lib/types";

export function TaskRow({ task, compact = false }: { task: TaskView; compact?: boolean }) {
  const [, submit, pending] = useActionState(toggleTask, null);
  const done = task.status === "done";
  const overdue = !done && task.due_on && task.due_on < todayKey();

  return (
    <li className={clsx("flex items-start gap-2.5", pending && "opacity-50")}>
      <form action={submit} className="pt-0.5">
        <input type="hidden" name="taskId" value={task.id} />
        <button
          type="submit"
          aria-label={done ? "Reopen task" : "Mark task done"}
          className={clsx(
            "flex size-4.5 items-center justify-center rounded-[5px] border transition-colors",
            done
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-line bg-white hover:border-brand-400",
          )}
        >
          {done ? <Check className="size-3" strokeWidth={3} /> : null}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            "text-[13px] leading-snug",
            done ? "text-ink-300 line-through" : "text-ink-900",
          )}
        >
          {task.title}
        </p>
        {!compact && task.detail ? (
          <p className="mt-0.5 text-[12px] text-ink-400">{task.detail}</p>
        ) : null}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-400">
          {task.due_on ? (
            <span className={overdue ? "font-medium text-rose-600" : undefined}>
              {overdue ? "Overdue " : ""}
              {compact ? relativeDay(task.due_on) : fmtDateShort(task.due_on)}
            </span>
          ) : null}
          {task.patient_name ? (
            <Link
              href={`/patients/${task.patient_id}`}
              className="truncate hover:text-brand-700 hover:underline"
            >
              {task.patient_name}
            </Link>
          ) : null}
          {!compact && task.assignee_name ? <span>· {task.assignee_name}</span> : null}
        </p>
      </div>
    </li>
  );
}
