"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { getHeaderTotals } from "@/lib/header-totals";
import { trpc } from "@/trpc/react";

const navItems = [
  { href: "/", label: "Spend" },
  { href: "/income", label: "Income" },
  { href: "/review", label: "Review" },
  { href: "/dashboard", label: "Stats" },
  { href: "/recurring", label: "Repeat" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { monthStart, monthEnd, monthLabel } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return {
      monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
      monthEnd: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      ),
      monthLabel: `${year}.${month}`,
    };
  }, []);

  const spendSummary = trpc.transactions.summary.useQuery({
    from: monthStart,
    to: monthEnd,
  });
  const incomeSummary = trpc.income.summary.useQuery({
    from: monthStart,
    to: monthEnd,
  });

  const totalsLoading = spendSummary.isLoading || incomeSummary.isLoading;
  const totalsError = spendSummary.isError || incomeSummary.isError;
  const spendNet = spendSummary.data?.netCents;
  const incomeNet = incomeSummary.data
    ? incomeSummary.data.revenueCents - incomeSummary.data.costCents
    : undefined;
  const formatter = new Intl.NumberFormat("ko-KR");
  const totals =
    spendNet === undefined || incomeNet === undefined
      ? null
      : getHeaderTotals(spendNet, incomeNet);
  const metrics = totals
    ? [
        { label: "Spend", value: totals.spendCents },
        { label: "Income", value: totals.incomeCents },
        { label: totals.balanceLabel, value: totals.balanceCents },
      ]
    : [
        { label: "Spend", value: null },
        { label: "Income", value: null },
        { label: "Outflow", value: null },
      ];

  return (
    <header className="overflow-hidden rounded-2xl bg-ink px-4 pb-3 pt-4 text-white shadow-[0_18px_45px_rgba(24,33,28,0.2)] sm:px-5">
      <div className="flex items-baseline justify-between gap-4 px-1">
        <p className="text-lg font-semibold tracking-[-0.025em]">Money Log</p>
        <p className="financial-number text-sm text-white/65">{monthLabel}</p>
      </div>

      <div aria-live="polite" aria-busy={totalsLoading} className="mt-3">
        {totalsError ? (
          <p role="status" className="border-t border-white/10 pt-3 text-sm text-white/65">
            Totals unavailable
          </p>
        ) : (
          <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-3">
            {metrics.map((metric, index) => (
              <div
                key={metric.label}
                className={`min-w-0 px-2 ${index === 0 ? "pl-0" : ""} ${index === 2 ? "pr-0" : ""}`}
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/55 sm:text-xs">
                  {metric.label}
                </p>
                <p className="financial-number mt-0.5 whitespace-nowrap text-[clamp(0.7rem,3.2vw,0.875rem)] font-semibold text-white">
                  {metric.value === null
                    ? "₩—"
                    : `₩${formatter.format(metric.value)}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <nav aria-label="Primary" className="mt-4 grid grid-cols-5 gap-1 rounded-xl bg-white/8 p-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 items-center justify-center rounded-lg px-1 py-2 text-center text-[11px] font-medium transition sm:text-sm ${
                isActive
                  ? "bg-surface text-ink shadow-sm"
                  : "text-white/65 hover:bg-white/8 hover:text-white"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
