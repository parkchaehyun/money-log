"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { trpc } from "@/trpc/react";

const LAST_SYNC_KEY = "money-log:lastRecurringSync";
const formatter = new Intl.NumberFormat("ko-KR");

type AutoAdded = {
  kind: "SPEND" | "INCOME";
  label: string;
  netCents: number;
};

// Dismissible banner listing recurring entries that were auto-added on sync.
function AutoAddedNotice({
  entries,
  onDismiss,
}: {
  entries: AutoAdded[];
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800">
            Added automatically
          </p>
          <ul className="mt-1 space-y-0.5">
            {entries.map((entry, index) => (
              <li key={index} className="text-xs text-emerald-700">
                {entry.label}{" "}
                <span className="font-semibold">
                  {entry.kind === "INCOME" ? "+" : ""}₩
                  {formatter.format(Math.abs(entry.netCents))}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/review"
            className="mt-2 inline-block text-xs font-semibold text-emerald-800 underline"
          >
            View in Review
          </Link>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// Runs the lazy recurring generation once per day per session (it's
// idempotent, so this guard just avoids redundant calls on navigation), and
// surfaces a dismissible notice for anything auto-added. Rendered on
// authenticated pages.
export function RecurringSync() {
  const utils = trpc.useUtils();
  const [notice, setNotice] = useState<AutoAdded[] | null>(null);

  const sync = trpc.recurring.sync.useMutation({
    onSuccess: async (result) => {
      await utils.recurring.pendingOccurrences.invalidate();
      if (result.created > 0) {
        await Promise.all([
          utils.transactions.list.invalidate(),
          utils.transactions.summary.invalidate(),
          utils.income.list.invalidate(),
          utils.dashboard.invalidate(),
        ]);
        setNotice(result.createdEntries);
      }
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const today = new Date().toDateString();
    if (window.sessionStorage.getItem(LAST_SYNC_KEY) === today) {
      return;
    }
    window.sessionStorage.setItem(LAST_SYNC_KEY, today);
    sync.mutate();
    // Only attempt once per mount; the sessionStorage guard handles the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!notice || notice.length === 0) {
    return null;
  }

  return <AutoAddedNotice entries={notice} onDismiss={() => setNotice(null)} />;
}
