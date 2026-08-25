"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

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
  const effectiveNet =
    spendNet === undefined || incomeNet === undefined
      ? undefined
      : spendNet - incomeNet;
  const formatter = new Intl.NumberFormat("ko-KR");
  const totalSummary =
    totalsLoading || totalsError || effectiveNet === undefined
      ? null
      : effectiveNet >= 0
        ? `Outflow ₩${formatter.format(effectiveNet)}`
        : `Surplus ₩${formatter.format(Math.abs(effectiveNet))}`;

  return (
    <header className="overflow-hidden rounded-2xl bg-ink px-4 pb-3 pt-4 text-white shadow-[0_18px_45px_rgba(24,33,28,0.2)] sm:px-5">
      <div className="flex items-start justify-between gap-4 px-1">
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-[-0.025em]">
            Money Log
          </p>
          <p
            className="financial-number mt-1 truncate text-sm text-white/70"
            aria-live="polite"
          >
            {monthLabel} ·{" "}
            {totalsLoading
              ? "Totals —"
              : totalsError
                ? "Totals unavailable"
                : totalSummary}
          </p>
        </div>
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-income" aria-hidden="true" />
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
