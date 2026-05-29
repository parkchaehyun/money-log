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
      <div className="flex items-center gap-3">
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
        <Link
          href="/recurring"
          aria-label="Recurring"
          title="Recurring"
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
            pathname === "/recurring"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 text-zinc-500 hover:text-zinc-900"
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
        </Link>
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
