"use client";

import { trpc } from "@/trpc/react";

const formatter = new Intl.NumberFormat("ko-KR");
const formatShortDate = (value: Date) => {
  const year = String(value.getFullYear()).slice(-2);
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

export function ReviewScreen() {
  const { data, isLoading, error } = trpc.transactions.list.useQuery({
    take: 60,
  });
  const entries = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
        <p className="text-sm text-zinc-500">Loading entries...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
        <p className="text-sm text-red-600">
          Unable to load entries. Please try again.
        </p>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
        <p className="text-sm text-zinc-500">No entries yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Review
          </p>
          <h2 className="text-2xl font-semibold text-zinc-900">
            Recent entries
          </h2>
        </div>
        <p className="text-sm text-zinc-500">{data.length} entries</p>
      </div>

      <div className="mt-6 space-y-3">
        {entries.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {item.merchant || "Untitled purchase"}
              </p>
              <p className="text-xs text-zinc-500">
                {formatShortDate(item.date)} ·{" "}
                {item.category?.name ?? "Uncategorized"} ·{" "}
                {item.paymentMethod?.name ?? "Unknown payment"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-zinc-900">
                ₩{formatter.format(item.netCents)}
              </p>
              {item.discountCents > 0 ? (
                <p className="text-xs text-zinc-500">
                  Saved ₩{formatter.format(item.discountCents)}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
