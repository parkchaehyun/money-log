"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { trpc } from "@/trpc/react";

const navItems = [
  { href: "/", label: "Spend" },
  { href: "/income", label: "Income" },
  { href: "/review", label: "Review" },
  { href: "/dashboard", label: "Dashboard" },
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

  const spendNet = spendSummary.data?.netCents ?? 0;
  const incomeNet =
    (incomeSummary.data?.revenueCents ?? 0) -
    (incomeSummary.data?.costCents ?? 0);
  const effectiveNet = spendNet - incomeNet;
  const formatter = new Intl.NumberFormat("ko-KR");
  const spendLabel = `+₩${formatter.format(Math.abs(spendNet))}`;
  const incomeLabel = `-₩${formatter.format(Math.abs(incomeNet))}`;
  const effectiveLabel =
    effectiveNet >= 0
      ? `=₩${formatter.format(effectiveNet)}`
      : `=-₩${formatter.format(Math.abs(effectiveNet))}`;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-zinc-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold tracking-tight text-zinc-900">
            Money Log
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {monthLabel}{" "}
            <span style={{ color: "#fb7185" }}>{spendLabel}</span>{" "}
            <span style={{ color: "#34d399" }}>{incomeLabel}</span>{" "}
            <span style={{ color: "#52525b" }}>{effectiveLabel}</span>
          </p>
        </div>
      </div>

      <nav className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.35fr)] gap-1 rounded-2xl bg-zinc-100 p-1 text-xs sm:flex sm:w-auto sm:gap-2 sm:rounded-full sm:text-sm">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-2 text-center text-xs font-medium transition sm:px-4 sm:py-2 sm:text-sm ${
                isActive
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
