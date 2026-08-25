"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { trpc } from "@/trpc/react";
import { MultiSelectionSheet } from "@/components/multi-selection-sheet";
import { resolveDashboardPeriod } from "@/lib/ui-behavior";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
});

const formatter = new Intl.NumberFormat("ko-KR");
const COLORS = {
  spend: "#b23b4d",
  income: "#19734e",
  net: "#18211c",
  muted: "#626a64",
  grid: "#d8d4ca",
};

const formatCurrency = (value: number) => `₩${formatter.format(Math.abs(value))}`;

const formatAxisValue = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 10_000) {
    const man = Math.round(abs / 10_000);
    return `${value < 0 ? "-" : ""}${man}만`;
  }
  return `${value < 0 ? "-" : ""}${formatter.format(abs)}`;
};

const monthLabels = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0")
);
const NO_TAG_ID = "no-tags";

export function DashboardScreen() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [categoryFilterIds, setCategoryFilterIds] = useState<string[]>([]);
  const [paymentFilterIds, setPaymentFilterIds] = useState<string[]>([]);
  const [tagFilterIds, setTagFilterIds] = useState<string[]>([]);
  const [includeNoTags, setIncludeNoTags] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);

  const yearsQuery = trpc.dashboard.years.useQuery();
  const years = useMemo(
    () => yearsQuery.data ?? [currentYear],
    [currentYear, yearsQuery.data]
  );
  const period = resolveDashboardPeriod({
    years,
    requestedYear: year,
    requestedMonth: month,
    currentYear,
    currentMonth,
  });

  const spendFilters = useMemo(
    () => ({
      categoryIds: categoryFilterIds.length ? categoryFilterIds : undefined,
      paymentMethodIds: paymentFilterIds.length ? paymentFilterIds : undefined,
      tagIds: tagFilterIds.length ? tagFilterIds : undefined,
      includeNoTags: includeNoTags || undefined,
    }),
    [categoryFilterIds, includeNoTags, paymentFilterIds, tagFilterIds]
  );

  const categoriesQuery = trpc.categories.list.useQuery();
  const paymentMethodsQuery = trpc.paymentMethods.list.useQuery();
  const tagsQuery = trpc.tags.list.useQuery();

  const categories = useMemo(
    () => (Array.isArray(categoriesQuery.data) ? categoriesQuery.data : []),
    [categoriesQuery.data]
  );
  const paymentMethods = useMemo(
    () =>
      Array.isArray(paymentMethodsQuery.data)
        ? paymentMethodsQuery.data
        : [],
    [paymentMethodsQuery.data]
  );
  const tags = useMemo(
    () => (Array.isArray(tagsQuery.data) ? tagsQuery.data : []),
    [tagsQuery.data]
  );

  const yearOverviewQuery = trpc.dashboard.yearOverview.useQuery({
    year: period.year,
    filters: spendFilters,
  });
  const monthCategoryQuery = trpc.dashboard.monthCategory.useQuery({
    year: period.year,
    month: period.month,
    filters: spendFilters,
  });
  const monthCardsQuery = trpc.dashboard.monthCards.useQuery({
    year: period.year,
    month: period.month,
    limit: 6,
    filters: spendFilters,
  });

  const yearOverview = yearOverviewQuery.data;
  const yearTotals = yearOverview?.totals ?? {
    spendNetCents: 0,
    incomeNetCents: 0,
    effectiveNetCents: 0,
  };

  const monthTotals = useMemo(() => {
    const match = yearOverview?.months.find((item) => item.month === period.month);
    return (
      match ?? {
        spendNetCents: 0,
        incomeNetCents: 0,
        effectiveNetCents: 0,
      }
    );
  }, [period.month, yearOverview?.months]);

  const availableMonths = useMemo(() => {
    if (period.year < currentYear) {
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
  }, [currentMonth, currentYear, period.year]);

  const monthLabel = `${period.year}.${monthLabels[period.month - 1]}`;
  const overviewUnavailable =
    yearOverviewQuery.isLoading || yearOverviewQuery.isError;
  const totalTagOptions = tags.length + 1;
  const selectedTagCount = tagFilterIds.length + (includeNoTags ? 1 : 0);
  const categorySummary =
    categoryFilterIds.length > 0
      ? `${categoryFilterIds.length} selected`
      : "All categories";
  const paymentSummary =
    paymentFilterIds.length > 0
      ? `${paymentFilterIds.length} selected`
      : "All payments";
  const tagSummary =
    selectedTagCount === 0 || selectedTagCount === totalTagOptions
      ? "All entries"
      : `${selectedTagCount} selected`;
  const hasFilters =
    categoryFilterIds.length > 0 ||
    paymentFilterIds.length > 0 ||
    (selectedTagCount > 0 && selectedTagCount !== totalTagOptions);
  const resetFilters = () => {
    setCategoryFilterIds([]);
    setPaymentFilterIds([]);
    setTagFilterIds([]);
    setIncludeNoTags(false);
  };

  const netTrendOption = useMemo(() => {
    const data = yearOverview?.months ?? [];
    return {
      aria: {
        enabled: true,
        description: "Monthly net outflow. Positive values mean spend exceeded income.",
      },
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
        splitLine: { lineStyle: { color: "#eae6dc" } },
        axisLabel: {
          color: COLORS.muted,
          formatter: (value: number) => formatAxisValue(value),
        },
      },
      series: [
        {
          name: "Net outflow",
          type: "line",
          data: data.map((item) => item.effectiveNetCents),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: COLORS.net, width: 3 },
          areaStyle: { color: "rgba(37, 110, 82, 0.12)" },
        },
      ],
    };
  }, [yearOverview?.months]);

  const spendIncomeOption = useMemo(() => {
    const data = yearOverview?.months ?? [];
    return {
      aria: {
        enabled: true,
        description: "Monthly spend and income comparison.",
      },
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
        splitLine: { lineStyle: { color: "#eae6dc" } },
        axisLabel: {
          color: COLORS.muted,
          formatter: (value: number) => formatAxisValue(value),
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
      aria: {
        enabled: true,
        description: "Spend by category for the selected month.",
      },
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
          itemStyle: { borderColor: "#fffdf8", borderWidth: 2 },
          label: { show: false },
          data,
        },
      ],
    };
  }, [monthCategoryQuery.data]);

  const cardOption = useMemo(() => {
    const data = monthCardsQuery.data ?? [];
    return {
      aria: {
        enabled: true,
        description: "Card gross spend and savings for the selected month.",
      },
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
        splitLine: { lineStyle: { color: "#eae6dc" } },
        axisLabel: {
          color: COLORS.muted,
          formatter: (value: number) => formatAxisValue(value),
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
    <section className="surface-panel p-4 sm:p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-medium text-ink-soft">Year</p>
              <select
                aria-label="Year"
                className="mt-2 rounded-xl border border-line bg-surface px-4 py-2 text-base text-ink transition focus:border-accent"
                value={period.year}
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
              <p className="text-sm font-medium text-ink-soft">Month</p>
              <select
                aria-label="Month"
                className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-2 text-base text-ink transition focus:border-accent"
                value={period.month}
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
                label: `${period.year} YTD`,
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
                className="rounded-xl bg-surface-soft/65 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  {item.label}
                </p>
                <div className="financial-number mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-expense"><span className="font-medium">Spend</span> {overviewUnavailable ? "₩—" : formatCurrency(item.spend)}</span>
                  <span className="text-income"><span className="font-medium">Income</span> {overviewUnavailable ? "₩—" : formatCurrency(item.income)}</span>
                  <span className="text-ink"><span className="font-medium">{item.effective >= 0 ? "Outflow" : "Surplus"}</span> {overviewUnavailable ? "₩—" : formatCurrency(item.effective)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface-soft/35 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Spend filters
            </p>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:text-line-strong"
            >
              Reset
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setCategorySheetOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-2 text-sm text-ink transition hover:border-line-strong"
            >
              <span className="font-medium">Categories</span>
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                {categorySummary}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentSheetOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-2 text-sm text-ink transition hover:border-line-strong"
            >
              <span className="font-medium">Payments</span>
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                {paymentSummary}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTagSheetOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-2 text-sm text-ink transition hover:border-line-strong"
            >
              <span className="font-medium">Tags</span>
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                {tagSummary}
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-7">
          <section className="rounded-2xl bg-accent-soft/55 p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-ink">Net outflow</h2>
              <span className="text-sm text-muted">Spend − income</span>
            </div>
            <div className="mt-3">
              {yearOverviewQuery.isLoading ? (
                <ChartStatus label="Loading trend…" />
              ) : yearOverviewQuery.isError ? (
                <ChartError onRetry={() => void yearOverviewQuery.refetch()} />
              ) : (
                <>
                  <ReactECharts option={netTrendOption} style={{ height: 320 }} />
                  <YearDataTable data={yearOverview?.months ?? []} caption="Monthly net outflow" />
                </>
              )}
            </div>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="text-lg font-semibold text-ink">Spend vs income</h2>
            <div className="mt-3">
              {yearOverviewQuery.isLoading ? (
                <ChartStatus label="Loading comparison…" />
              ) : yearOverviewQuery.isError ? (
                <ChartError onRetry={() => void yearOverviewQuery.refetch()} />
              ) : (
                <>
                  <ReactECharts option={spendIncomeOption} style={{ height: 280 }} />
                  <YearDataTable data={yearOverview?.months ?? []} caption="Monthly spend and income" />
                </>
              )}
            </div>
          </section>

          <div className="grid gap-7 border-t border-line pt-6 md:grid-cols-2">
            <section className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-ink">Categories</h2>
                <span className="text-sm text-muted">{monthLabel}</span>
              </div>
              <div className="mt-3">
                {monthCategoryQuery.isLoading ? (
                  <ChartStatus label="Loading categories…" />
                ) : monthCategoryQuery.isError ? (
                  <ChartError onRetry={() => void monthCategoryQuery.refetch()} />
                ) : monthCategoryQuery.data?.length ? (
                  <>
                    <ReactECharts option={categoryOption} style={{ height: 280 }} />
                    <CategoryDataTable data={monthCategoryQuery.data} />
                  </>
                ) : (
                  <ChartStatus label="No spend data" />
                )}
              </div>
            </section>

            <section className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-ink">Cards</h2>
                <span className="text-sm text-muted">{monthLabel}</span>
              </div>
              <div className="mt-3">
                {monthCardsQuery.isLoading ? (
                  <ChartStatus label="Loading cards…" />
                ) : monthCardsQuery.isError ? (
                  <ChartError onRetry={() => void monthCardsQuery.refetch()} />
                ) : monthCardsQuery.data?.length ? (
                  <>
                    <ReactECharts option={cardOption} style={{ height: 280 }} />
                    <CardDataTable data={monthCardsQuery.data} />
                  </>
                ) : (
                  <ChartStatus label="No card data" />
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <MultiSelectionSheet
        open={categorySheetOpen}
        title="Categories"
        items={categories.map((category) => ({
          id: category.id,
          label: category.name,
        }))}
        selectedIds={categoryFilterIds}
        onClose={() => setCategorySheetOpen(false)}
        onToggle={(id) =>
          setCategoryFilterIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
          )
        }
        onClear={() => setCategoryFilterIds([])}
        clearLabel="Clear categories"
      />

      <MultiSelectionSheet
        open={paymentSheetOpen}
        title="Payments"
        items={paymentMethods.map((method) => ({
          id: method.id,
          label: method.name,
        }))}
        selectedIds={paymentFilterIds}
        onClose={() => setPaymentSheetOpen(false)}
        onToggle={(id) =>
          setPaymentFilterIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
          )
        }
        onClear={() => setPaymentFilterIds([])}
        clearLabel="Clear payments"
      />

      <MultiSelectionSheet
        open={tagSheetOpen}
        title="Tags"
        items={[
          { id: NO_TAG_ID, label: "No tags" },
          ...tags.map((tag) => ({ id: tag.id, label: tag.name })),
        ]}
        selectedIds={
          includeNoTags ? [NO_TAG_ID, ...tagFilterIds] : tagFilterIds
        }
        onClose={() => setTagSheetOpen(false)}
        onToggle={(id) => {
          if (id === NO_TAG_ID) {
            setIncludeNoTags((prev) => !prev);
            return;
          }
          setTagFilterIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
          );
        }}
        onClear={() => {
          setTagFilterIds([]);
          setIncludeNoTags(false);
        }}
        clearLabel="Clear tags"
      />
    </section>
  );
}

function ChartStatus({ label }: { label: string }) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-xl bg-surface-soft/50 px-4 text-sm text-muted" role="status">
      {label}
    </div>
  );
}

function ChartError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-56 items-center justify-center gap-3 rounded-xl bg-danger/5 px-4" role="alert">
      <span className="text-sm text-danger">Couldn’t load chart.</span>
      <button type="button" onClick={onRetry} className="rounded-lg px-3 text-sm font-semibold text-danger hover:bg-white">Retry</button>
    </div>
  );
}

function YearDataTable({
  data,
  caption,
}: {
  data: Array<{
    month: number;
    spendNetCents: number;
    incomeNetCents: number;
    effectiveNetCents: number;
  }>;
  caption: string;
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr><th scope="col">Month</th><th scope="col">Spend</th><th scope="col">Income</th><th scope="col">Net outflow</th></tr></thead>
      <tbody>{data.map((item) => <tr key={item.month}><th scope="row">{monthLabels[item.month - 1]}</th><td>{formatCurrency(item.spendNetCents)}</td><td>{formatCurrency(item.incomeNetCents)}</td><td>{item.effectiveNetCents < 0 ? "Surplus " : ""}{formatCurrency(item.effectiveNetCents)}</td></tr>)}</tbody>
    </table>
  );
}

function CategoryDataTable({ data }: { data: Array<{ id: string; name: string; netCents: number }> }) {
  return (
    <table className="sr-only">
      <caption>Spend by category</caption>
      <thead><tr><th scope="col">Category</th><th scope="col">Spend</th></tr></thead>
      <tbody>{data.map((item) => <tr key={item.id}><th scope="row">{item.name}</th><td>{formatCurrency(item.netCents)}</td></tr>)}</tbody>
    </table>
  );
}

function CardDataTable({ data }: { data: Array<{ id: string; name: string; grossCents: number; discountCents: number }> }) {
  return (
    <table className="sr-only">
      <caption>Card spend and savings</caption>
      <thead><tr><th scope="col">Card</th><th scope="col">Gross</th><th scope="col">Saved</th></tr></thead>
      <tbody>{data.map((item) => <tr key={item.id}><th scope="row">{item.name}</th><td>{formatCurrency(item.grossCents)}</td><td>{formatCurrency(item.discountCents)}</td></tr>)}</tbody>
    </table>
  );
}
