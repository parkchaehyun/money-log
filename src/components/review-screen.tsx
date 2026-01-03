"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";

const formatter = new Intl.NumberFormat("ko-KR");
const formatShortDate = (value: Date) => {
  const year = String(value.getFullYear()).slice(-2);
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

export function ReviewScreen() {
  const [mode, setMode] = useState<"spend" | "income">("spend");

  const spendQuery = trpc.transactions.list.useQuery(
    { take: 60 },
    { enabled: mode === "spend" }
  );
  const incomeQuery = trpc.income.list.useQuery(
    { take: 60 },
    { enabled: mode === "income" }
  );

  const spendEntries = Array.isArray(spendQuery.data) ? spendQuery.data : [];
  const incomeEntries = Array.isArray(incomeQuery.data) ? incomeQuery.data : [];
  const entryCount = mode === "spend" ? spendEntries.length : incomeEntries.length;
  const isLoading = mode === "spend" ? spendQuery.isLoading : incomeQuery.isLoading;
  const error = mode === "spend" ? spendQuery.error : incomeQuery.error;
  const heading = mode === "spend" ? "Recent spend" : "Recent income";
  const emptyMessage =
    mode === "spend" ? "No spend entries yet." : "No income entries yet.";
  const errorMessage =
    mode === "spend"
      ? "Unable to load spend entries."
      : "Unable to load income entries.";

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Review
          </p>
          <h2 className="text-2xl font-semibold text-zinc-900">{heading}</h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-500">{entryCount} entries</p>
          <div className="flex items-center gap-2 rounded-full bg-zinc-100 p-1 text-sm">
            {[
              { id: "spend", label: "Spend" },
              { id: "income", label: "Income" },
            ].map((item) => {
              const isActive = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id as "spend" | "income")}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading entries...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : entryCount === 0 ? (
          <p className="text-sm text-zinc-500">{emptyMessage}</p>
        ) : mode === "spend" ? (
          spendEntries.map((item) => (
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
          ))
        ) : (
          incomeEntries.map((item) => {
            const net = item.revenueCents - item.costCents;
            const dateLabel = formatShortDate(item.date);
            const metaLabel = item.card?.name
              ? `${dateLabel} · ${item.card.name}`
              : dateLabel;
            const netColor =
              net > 0 ? "#16a34a" : net < 0 ? "#f43f5e" : "#71717a";
            const netLabel =
              net > 0
                ? `+₩${formatter.format(net)}`
                : net < 0
                  ? `-₩${formatter.format(Math.abs(net))}`
                  : `₩${formatter.format(0)}`;
            const revenueLabel = `+₩${formatter.format(item.revenueCents)}`;
            const costLabel = `-₩${formatter.format(item.costCents)}`;
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {item.description}
                  </p>
                  <p className="text-xs text-zinc-500">{metaLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold" style={{ color: netColor }}>
                    {netLabel}
                  </p>
                  {item.costCents > 0 ? (
                    <p className="text-xs text-zinc-400">
                      <span style={{ color: "rgba(22, 163, 74, 0.8)" }}>
                        {revenueLabel}
                      </span>
                      <span style={{ color: "#d4d4d8" }}> · </span>
                      <span style={{ color: "rgba(244, 63, 94, 0.8)" }}>
                        {costLabel}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
