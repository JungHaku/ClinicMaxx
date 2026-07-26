import Link from "next/link";
import { SearchX } from "lucide-react";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-100">
        <SearchX className="size-7 text-brand-700" />
      </span>
      <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">
        We couldn&apos;t find that
      </h1>
      <p className="mt-2 max-w-sm text-[14px] text-ink-400">
        The client, invoice or page you were looking for doesn&apos;t exist — or it may have been
        archived.
      </p>
      <div className="mt-6 flex gap-2">
        <Link
          href="/dashboard"
          className="rounded-lg bg-brand-600 px-4 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-brand-700"
        >
          Back to the dashboard
        </Link>
        <Link
          href="/patients"
          className="rounded-lg border border-line bg-surface px-4 py-2 text-[13.5px] font-medium text-ink-700 transition-colors hover:bg-brand-50"
        >
          Search clients
        </Link>
      </div>
    </div>
  );
}
