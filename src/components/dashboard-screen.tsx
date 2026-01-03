"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { trpc } from "@/trpc/react";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
});

const formatter = new Intl.NumberFormat("ko-KR");
const COLORS = {
  spend: "#fb7185",
  income: "#34d399",
  net: "#0f172a",
  muted: "#94a3b8",
  grid: "#e4e4e7",
};

const formatCurrency = (value: number) => `₩${formatter.format(Math.abs(value))}`;

const formatSigned = (value: number, sign: "+" | "-" | "=") =>
  `${sign}₩${formatter.format(Math.abs(value))}`;

const monthLabels = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0")
);

export function DashboardScreen() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);

  const yearsQuery = trpc.dashboard.years.useQuery();
  const years = yearsQuery.data ?? [currentYear];

  useEffect(() => {
    if (years.length && !years.includes(year)) {
      setYear(years[0]);
    }
  }, [year, years]);

  const yearOverviewQuery = trpc.dashboard.yearOverview.useQuery({ year });
  const monthCategoryQuery = trpc.dashboard.monthCategory.useQuery({
    year,
    month,
  });
  const monthCardsQuery = trpc.dashboard.monthCards.useQuery({
    year,
    month,
    limit: 6,
  });

  const yearOverview = yearOverviewQuery.data;
  const yearTotals = yearOverview?.totals ?? {
    spendNetCents: 0,
    incomeNetCents: 0,
    effectiveNetCents: 0,
  };

  const monthTotals = useMemo(() => {
    const match = yearOverview?.months.find((item) => item.month === month);
    return (
      match ?? {
        spendNetCents: 0,
        incomeNetCents: 0,
        effectiveNetCents: 0,
      }
    );
  }, [month, yearOverview?.months]);

  const availableMonths = useMemo(() => {
    if (year < currentYear) {
      return monthLabels.map((label, index) => ({
        value: index + 1,
        label,
      }));
    }
    const lastMonth = Math.min(currentMonth, 12);
    return monthLabels.slice(0, lastMonth).map((label, index) => ({
      value: index + 1,
      label,
    }));
  }, [currentMonth, currentYear, year]);

  useEffect(() => {
    if (!availableMonths.some((item) => item.value === month)) {
      const fallback =
        availableMonths[availableMonths.length - 1]?.value ?? currentMonth;
      setMonth(fallback);
    }
  }, [availableMonths, currentMonth, month]);

  const monthLabel = `${year}.${monthLabels[month - 1]}`;

  const netTrendOption = useMemo(() => {
    const data = yearOverview?.months ?? [];
    return {
      grid: { left: 16, right: 16, top: 24, bottom: 24, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: number) => `₩${formatter.format(value)}`,
      },
      xAxis: {
        type: "category",
        data: data.map((item) => monthLabels[item.month - 1]),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.grid } },
        axisLabel: { color: COLORS.muted },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f4f4f5" } },
        axisLabel: {
          color: COLORS.muted,
          formatter: (value: number) => `₩${formatter.format(value)}`,
        },
      },
      series: [
        {
          name: "Net",
          type: "line",
          data: data.map((item) => item.effectiveNetCents),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: COLORS.net, width: 3 },
          areaStyle: { color: "rgba(15, 23, 42, 0.08)" },
        },
      ],
    };
  }, [yearOverview?.months]);

  const spendIncomeOption = useMemo(() => {
    const data = yearOverview?.months ?? [];
    return {
      grid: { left: 16, right: 16, top: 24, bottom: 24, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: number) => `₩${formatter.format(value)}`,
      },
      legend: {
        data: ["Spend", "Income"],
        textStyle: { color: COLORS.muted },
        top: 0,
      },
      xAxis: {
        type: "category",
        data: data.map((item) => monthLabels[item.month - 1]),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.grid } },
        axisLabel: { color: COLORS.muted },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f4f4f5" } },
        axisLabel: {
          color: COLORS.muted,
          formatter: (value: number) => `₩${formatter.format(value)}`,
        },
      },
      series: [
        {
          name: "Spend",
          type: "bar",
          data: data.map((item) => item.spendNetCents),
          barMaxWidth: 22,
          itemStyle: { color: COLORS.spend },
        },
        {
          name: "Income",
          type: "bar",
          data: data.map((item) => item.incomeNetCents),
          barMaxWidth: 22,
          itemStyle: { color: COLORS.income },
        },
      ],
    };
  }, [yearOverview?.months]);

  const categoryOption = useMemo(() => {
    const data = (monthCategoryQuery.data ?? []).map((item) => ({
      name: item.name,
      value: item.netCents,
    }));
    return {
      tooltip: {
        trigger: "item",
        formatter: (params: { name: string; value: number }) =>
          `${params.name}<br/>₩${formatter.format(params.value)}`,
      },
      series: [
        {
          name: "Categories",
          type: "pie",
          radius: ["45%", "70%"],
          itemStyle: { borderColor: "#fff", borderWidth: 2 },
          label: { show: false },
          data,
        },
      ],
    };
  }, [monthCategoryQuery.data]);

  const cardOption = useMemo(() => {
    const data = monthCardsQuery.data ?? [];
    return {
      grid: { left: 16, right: 16, top: 24, bottom: 24, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (value: number) => `₩${formatter.format(value)}`,
      },
      legend: {
        data: ["Gross", "Saved"],
        textStyle: { color: COLORS.muted },
        top: 0,
      },
      xAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f4f4f5" } },
        axisLabel: {
          color: COLORS.muted,
          formatter: (value: number) => `₩${formatter.format(value)}`,
        },
      },
      yAxis: {
        type: "category",
        data: data.map((item) => item.name),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: COLORS.muted },
      },
      series: [
        {
          name: "Gross",
          type: "bar",
          data: data.map((item) => item.grossCents),
          barMaxWidth: 16,
          itemStyle: { color: COLORS.spend },
        },
        {
          name: "Saved",
          type: "bar",
          data: data.map((item) => item.discountCents),
          barMaxWidth: 16,
          itemStyle: { color: COLORS.income },
        },
      ],
    };
  }, [monthCardsQuery.data]);

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Year
              </p>
              <select
                className="mt-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              >
                {years.map((yearOption) => (
                  <option key={yearOption} value={yearOption}>
                    {yearOption}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px]">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Month
              </p>
              <select
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
              >
                {availableMonths.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: `${year} YTD`,
                spend: yearTotals.spendNetCents,
                income: yearTotals.incomeNetCents,
                effective: yearTotals.effectiveNetCents,
              },
              {
                label: monthLabel,
                spend: monthTotals.spendNetCents,
                income: monthTotals.incomeNetCents,
                effective: monthTotals.effectiveNetCents,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  {item.label}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span style={{ color: COLORS.spend }}>
                    {formatSigned(item.spend, "+")}
                  </span>
                  <span style={{ color: COLORS.income }}>
                    {formatSigned(item.income, "-")}
                  </span>
                  <span style={{ color: COLORS.net }}>
                    {item.effective >= 0
                      ? formatSigned(item.effective, "=")
                      : `=-${formatCurrency(item.effective)}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-3xl border border-zinc-100 bg-white px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Year Trend
                </p>
                <h3 className="text-lg font-semibold text-zinc-900">
                  Effective Net
                </h3>
              </div>
            </div>
            <div className="mt-4">
              <ReactECharts option={netTrendOption} style={{ height: 280 }} />
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-100 bg-white px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Year Mix
                </p>
                <h3 className="text-lg font-semibold text-zinc-900">
                  Spend vs Income
                </h3>
              </div>
            </div>
            <div className="mt-4">
              <ReactECharts option={spendIncomeOption} style={{ height: 280 }} />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-zinc-100 bg-white px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    {monthLabel}
                  </p>
                  <h3 className="text-lg font-semibold text-zinc-900">
                    Category Breakdown
                  </h3>
                </div>
              </div>
              <div className="mt-4">
                {monthCategoryQuery.data?.length ? (
                  <ReactECharts option={categoryOption} style={{ height: 280 }} />
                ) : (
                  <p className="text-sm text-zinc-500">No spend data yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-white px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    {monthLabel}
                  </p>
                  <h3 className="text-lg font-semibold text-zinc-900">
                    Card Spend vs Saved
                  </h3>
                </div>
              </div>
              <div className="mt-4">
                {monthCardsQuery.data?.length ? (
                  <ReactECharts option={cardOption} style={{ height: 280 }} />
                ) : (
                  <p className="text-sm text-zinc-500">No card data yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
