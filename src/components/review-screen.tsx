"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { trpc } from "@/trpc/react";
import { DiscountInput } from "@/components/discount-input";
import { MultiSelectionSheet } from "@/components/multi-selection-sheet";
import { MonthYearPicker } from "@/components/month-year-picker";
import {
  writeIncomePrefill,
  writeRecurringPrefill,
  writeSpendPrefill,
} from "@/lib/entry-prefill";
import {
  toPaymentMethodDraft,
  toPaymentMethodUpdate,
} from "@/lib/review-spend-edit";
import { countAdvancedReviewFilters } from "@/lib/ui-behavior";

const formatter = new Intl.NumberFormat("ko-KR");

const formatLocalDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatShortDate = (value: Date) => {
  const year = String(value.getFullYear()).slice(-2);
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

const formatShortDateString = (value: string) => {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${year.slice(-2)}.${month}.${day}`;
};

const parseDateInput = (value: string, endOfDay = false) => {
  if (!value) {
    return undefined;
  }
  const suffix = endOfDay ? "23:59:59.999" : "00:00:00.000";
  const parsed = new Date(`${value}T${suffix}`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
};

const sanitizeNumber = (value: string) => value.replace(/[^\d]/g, "");

const formatDigits = (value: string) => {
  if (!value) {
    return "";
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return "";
  }
  return formatter.format(parsed);
};

const parseCents = (value: string) => {
  const cleaned = sanitizeNumber(value);
  if (!cleaned) {
    return undefined;
  }
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const formatSignedAmount = (value: number) => {
  if (value > 0) {
    return { label: `+₩${formatter.format(value)}`, color: "#16a34a" };
  }
  if (value < 0) {
    return {
      label: `-₩${formatter.format(Math.abs(value))}`,
      color: "#f43f5e",
    };
  }
  return { label: `₩${formatter.format(0)}`, color: "#71717a" };
};

const groupByDate = <T,>(
  entries: T[],
  getDate: (entry: T) => Date,
  getValue: (entry: T) => number
) => {
  const groups: { date: string; total: number; entries: T[] }[] = [];
  entries.forEach((entry) => {
    const key = formatLocalDate(getDate(entry));
    const last = groups[groups.length - 1];
    if (last && last.date === key) {
      last.entries.push(entry);
      last.total += getValue(entry);
      return;
    }
    groups.push({ date: key, total: getValue(entry), entries: [entry] });
  });
  return groups;
};

const defaultFromDate = () => {
  const now = new Date();
  return formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
};

const defaultToDate = () => {
  const now = new Date();
  return formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
};

const currentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export function ReviewScreen() {
  const utils = trpc.useUtils();
  const router = useRouter();
  const [mode, setMode] = useState<"spend" | "income">("spend");
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [cardId, setCardId] = useState("");
  const [minNetInput, setMinNetInput] = useState("");
  const [maxNetInput, setMaxNetInput] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [includeUntagged, setIncludeUntagged] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [spendTake, setSpendTake] = useState(60);
  const [incomeTake, setIncomeTake] = useState(60);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [spendEditingId, setSpendEditingId] = useState<string | null>(null);
  const [spendDraft, setSpendDraft] = useState({
    merchant: "",
    gross: "",
    discount: "",
    date: "",
    categoryId: "",
    paymentMethodId: "",
    notes: "",
    tagIds: [] as string[],
  });
  const [spendEditTagSheetOpen, setSpendEditTagSheetOpen] = useState(false);
  const [spendEditError, setSpendEditError] = useState<string | null>(null);
  const [spendDiscountCalculationError, setSpendDiscountCalculationError] =
    useState<string | null>(null);
  const [incomeEditingId, setIncomeEditingId] = useState<string | null>(null);
  const [incomeDraft, setIncomeDraft] = useState({
    description: "",
    revenue: "",
    cost: "",
    cardId: "",
    date: "",
  });
  const [incomeEditError, setIncomeEditError] = useState<string | null>(null);

  const fromValue = parseDateInput(fromDate);
  const toValue = parseDateInput(toDate, true);
  const deferredSearch = useDeferredValue(search);
  const searchValue = deferredSearch.trim();
  const minNetCents = parseCents(minNetInput);
  const maxNetCents = parseCents(maxNetInput);

  const spendFilterInput = useMemo(
    () => ({
      from: fromValue,
      to: toValue,
      categoryId: categoryId || undefined,
      paymentMethodId: paymentMethodId || undefined,
      search: searchValue || undefined,
      minNetCents,
      maxNetCents,
      tagIds: selectedTagIds.length ? selectedTagIds : undefined,
      includeUntagged: includeUntagged || undefined,
    }),
    [
      categoryId,
      fromValue,
      includeUntagged,
      maxNetCents,
      minNetCents,
      paymentMethodId,
      searchValue,
      selectedTagIds,
      toValue,
    ]
  );

  const incomeFilterInput = useMemo(
    () => ({
      from: fromValue,
      to: toValue,
      cardId: cardId || undefined,
      search: searchValue || undefined,
    }),
    [cardId, fromValue, searchValue, toValue]
  );

  const spendQuery = trpc.transactions.list.useQuery(
    { ...spendFilterInput, take: spendTake },
    { enabled: mode === "spend" }
  );
  const spendSummaryQuery = trpc.transactions.summary.useQuery(
    spendFilterInput,
    { enabled: mode === "spend" }
  );
  const incomeQuery = trpc.income.list.useQuery(
    { ...incomeFilterInput, take: incomeTake },
    { enabled: mode === "income" }
  );
  const incomeSummaryQuery = trpc.income.summary.useQuery(incomeFilterInput, {
    enabled: mode === "income",
  });

  const spendDateRangeQuery = trpc.transactions.dateRange.useQuery();
  const incomeDateRangeQuery = trpc.income.dateRange.useQuery();

  // Months grouped by year (newest first), each group offering a "Whole year"
  // option plus its months. Powers the optgroup'd Month picker.
  const monthGroups = useMemo(() => {
    const spendMin = spendDateRangeQuery.data?.min;
    const spendMax = spendDateRangeQuery.data?.max;
    const incomeMin = incomeDateRangeQuery.data?.min;
    const incomeMax = incomeDateRangeQuery.data?.max;

    // Always include "now" so the current month is selectable (and is the
    // default), even when there's no data in it yet.
    const dates = [spendMin, spendMax, incomeMin, incomeMax, new Date()].filter(
      (d): d is Date => d instanceof Date
    );

    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));

    const byYear = new Map<number, { value: string; label: string }[]>();
    const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
    const end = new Date(max.getFullYear(), max.getMonth(), 1);
    while (cursor <= end) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const value = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = cursor.toLocaleString("en-US", { month: "short" });
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year)!.push({ value, label });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return Array.from(byYear.entries())
      .map(([year, months]) => ({ year, months: months.reverse() }))
      .sort((a, b) => b.year - a.year);
  }, [spendDateRangeQuery.data, incomeDateRangeQuery.data]);

  const categoriesQuery = trpc.categories.list.useQuery(undefined, {
    enabled: mode === "spend",
  });
  const paymentMethodsQuery = trpc.paymentMethods.list.useQuery(undefined, {
    enabled: mode === "spend",
  });
  const cardsQuery = trpc.cards.list.useQuery(undefined, {
    enabled: mode === "income",
  });
  const tagsQuery = trpc.tags.list.useQuery(undefined, {
    enabled: mode === "spend",
  });

  const spendEntries = useMemo(
    () => (Array.isArray(spendQuery.data) ? spendQuery.data : []),
    [spendQuery.data]
  );
  const incomeEntries = useMemo(
    () => (Array.isArray(incomeQuery.data) ? incomeQuery.data : []),
    [incomeQuery.data]
  );
  const entryCount =
    mode === "spend" ? spendEntries.length : incomeEntries.length;
  const isLoading =
    mode === "spend" ? spendQuery.isLoading : incomeQuery.isLoading;
  const error = mode === "spend" ? spendQuery.error : incomeQuery.error;
  const emptyMessage =
    mode === "spend" ? "No spend entries yet." : "No income entries yet.";
  const errorMessage =
    mode === "spend"
      ? "Unable to load spend entries."
      : "Unable to load income entries.";

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
  const cards = useMemo(
    () => (Array.isArray(cardsQuery.data) ? cardsQuery.data : []),
    [cardsQuery.data]
  );
  const tags = useMemo(
    () => (Array.isArray(tagsQuery.data) ? tagsQuery.data : []),
    [tagsQuery.data]
  );

  const updateTransaction = trpc.transactions.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.transactions.list.invalidate(),
        utils.transactions.summary.invalidate(),
        utils.transactions.merchantOptions.invalidate(),
        utils.dashboard.invalidate(),
      ]);
      setSpendEditingId(null);
    },
  });

  const createTag = trpc.tags.create.useMutation({
    onSuccess: () => utils.tags.list.invalidate(),
  });

  const deleteTransaction = trpc.transactions.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.transactions.list.invalidate(),
        utils.transactions.summary.invalidate(),
        utils.transactions.merchantOptions.invalidate(),
        utils.dashboard.invalidate(),
      ]);
    },
  });

  const updateIncome = trpc.income.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.income.list.invalidate(),
        utils.income.summary.invalidate(),
        utils.income.sourceOptions.invalidate(),
        utils.dashboard.invalidate(),
      ]);
      setIncomeEditingId(null);
    },
  });

  const deleteIncome = trpc.income.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.income.list.invalidate(),
        utils.income.summary.invalidate(),
        utils.income.sourceOptions.invalidate(),
        utils.dashboard.invalidate(),
      ]);
    },
  });

  const resetPagination = () => {
    setSpendTake(60);
    setIncomeTake(60);
  };

  const changeMode = (nextMode: "spend" | "income") => {
    setMode(nextMode);
    setSpendEditingId(null);
    setIncomeEditingId(null);
    setSpendEditError(null);
    setIncomeEditError(null);
  };

  const applyMonthSelection = (value: string) => {
    resetPagination();
    setSelectedMonth(value);
    if (!value) {
      return; // "Custom range" — leave From/To as-is for manual editing.
    }
    if (value.includes("-")) {
      const [y, m] = value.split("-").map(Number);
      setFromDate(formatLocalDate(new Date(y, m - 1, 1)));
      setToDate(formatLocalDate(new Date(y, m, 0)));
    } else {
      const y = Number(value);
      setFromDate(formatLocalDate(new Date(y, 0, 1)));
      setToDate(formatLocalDate(new Date(y, 11, 31)));
    }
  };

  const resetFilters = () => {
    resetPagination();
    setFromDate(defaultFromDate());
    setToDate(defaultToDate());
    setSelectedMonth(currentMonthValue());
    setSearch("");
    setCategoryId("");
    setPaymentMethodId("");
    setCardId("");
    setMinNetInput("");
    setMaxNetInput("");
    setSelectedTagIds([]);
    setIncludeUntagged(false);
  };

  const summary = spendSummaryQuery.data ?? {
    grossCents: 0,
    discountCents: 0,
    netCents: 0,
    count: 0,
  };
  const incomeSummary = incomeSummaryQuery.data ?? {
    revenueCents: 0,
    costCents: 0,
    netCents: 0,
    count: 0,
  };
  const summaryPending =
    mode === "spend"
      ? spendSummaryQuery.isLoading || spendSummaryQuery.isError
      : incomeSummaryQuery.isLoading || incomeSummaryQuery.isError;

  const spendGroups = useMemo(
    () => groupByDate(spendEntries, (item) => item.date, (item) => item.netCents),
    [spendEntries]
  );

  const incomeGroups = useMemo(
    () =>
      groupByDate(
        incomeEntries,
        (item) => item.date,
        (item) => item.revenueCents - item.costCents
      ),
    [incomeEntries]
  );

  const canLoadMore =
    mode === "spend"
      ? spendEntries.length >= spendTake
      : incomeEntries.length >= incomeTake;

  const selectedCount = selectedTagIds.length + (includeUntagged ? 1 : 0);
  const allTagsSelected =
    includeUntagged && selectedTagIds.length === tags.length;
  const tagSummary =
    selectedCount === 0 || allTagsSelected
      ? "All entries"
      : `${selectedCount} selected`;
  const advancedFilterCount = countAdvancedReviewFilters({
    customRange: selectedMonth === "",
    categoryId,
    paymentMethodId,
    cardId,
    minAmount: minNetInput,
    maxAmount: maxNetInput,
    tagCount: selectedCount,
  });

  const loadMore = () => {
    if (mode === "spend") {
      setSpendTake((prev) => prev + 40);
    } else {
      setIncomeTake((prev) => prev + 40);
    }
  };

  const toggleSpendEdit = (entry: typeof spendEntries[number]) => {
    if (spendEditingId === entry.id) {
      setSpendEditingId(null);
      setSpendDiscountCalculationError(null);
      return;
    }
    setSpendEditingId(entry.id);
    setSpendDraft({
      merchant: entry.merchant ?? "",
      gross: String(entry.grossCents),
      discount: String(entry.discountCents),
      date: formatLocalDate(entry.date),
      categoryId: entry.categoryId ?? "",
      paymentMethodId: toPaymentMethodDraft(entry.paymentMethodId),
      notes: entry.notes ?? "",
      tagIds: entry.tags.map((t) => t.tagId),
    });
    setSpendEditError(null);
    setSpendDiscountCalculationError(null);
  };

  const toggleIncomeEdit = (entry: typeof incomeEntries[number]) => {
    if (incomeEditingId === entry.id) {
      setIncomeEditingId(null);
      return;
    }
    setIncomeEditingId(entry.id);
    setIncomeDraft({
      description: entry.description ?? "",
      revenue: String(entry.revenueCents),
      cost: String(entry.costCents),
      cardId: entry.cardId ?? "",
      date: formatLocalDate(entry.date),
    });
    setIncomeEditError(null);
  };

  const handleSpendSave = async (entryId: string) => {
    const grossCents = Number.parseInt(spendDraft.gross || "0", 10) || 0;
    const discountCents = Number.parseInt(spendDraft.discount || "0", 10) || 0;
    const date = parseDateInput(spendDraft.date);
    if (grossCents <= 0) {
      setSpendEditError("Enter an amount.");
      return;
    }
    if (discountCents > grossCents) {
      setSpendEditError("Discount cannot exceed amount.");
      return;
    }
    if (spendDiscountCalculationError) {
      return;
    }
    if (!date) {
      setSpendEditError("Enter a valid date.");
      return;
    }
    setSpendEditError(null);
    try {
      await updateTransaction.mutateAsync({
        id: entryId,
        merchant: spendDraft.merchant.trim() || null,
        grossCents,
        discountCents,
        date,
        categoryId: spendDraft.categoryId || null,
        paymentMethodId: toPaymentMethodUpdate(spendDraft.paymentMethodId),
        notes: spendDraft.notes.trim() || null,
        tagIds: spendDraft.tagIds,
      });
    } catch {
      setSpendEditError("Unable to update entry.");
    }
  };

  const handleIncomeSave = async (entryId: string) => {
    const revenueCents = Number.parseInt(incomeDraft.revenue || "0", 10) || 0;
    const costCents = Number.parseInt(incomeDraft.cost || "0", 10) || 0;
    const date = parseDateInput(incomeDraft.date);
    if (revenueCents <= 0 && costCents <= 0) {
      setIncomeEditError("Enter revenue or cost.");
      return;
    }
    if (!incomeDraft.description.trim()) {
      setIncomeEditError("Add a description.");
      return;
    }
    if (!date) {
      setIncomeEditError("Enter a valid date.");
      return;
    }
    setIncomeEditError(null);
    try {
      await updateIncome.mutateAsync({
        id: entryId,
        description: incomeDraft.description.trim(),
        revenueCents,
        costCents,
        cardId: incomeDraft.cardId || null,
        date,
      });
    } catch {
      setIncomeEditError("Unable to update entry.");
    }
  };

  const handleSpendDuplicate = (entry: typeof spendEntries[number]) => {
    writeSpendPrefill({
      amount: String(entry.grossCents),
      discount: entry.discountCents > 0 ? String(entry.discountCents) : "",
      merchant: entry.merchant ?? "",
      notes: entry.notes ?? "",
      categoryId: entry.categoryId ?? null,
      paymentMethodId: entry.paymentMethodId ?? null,
      tagIds: entry.tags.map((t) => t.tagId),
    });
    router.push("/");
  };

  const handleIncomeDuplicate = (entry: typeof incomeEntries[number]) => {
    writeIncomePrefill({
      revenue: String(entry.revenueCents),
      cost: entry.costCents > 0 ? String(entry.costCents) : "",
      description: entry.description ?? "",
      cardId: entry.cardId ?? null,
    });
    router.push("/income");
  };

  const handleSpendRepeat = (entry: typeof spendEntries[number]) => {
    writeRecurringPrefill({
      kind: "SPEND",
      dayOfMonth: entry.date.getDate(),
      merchant: entry.merchant ?? "",
      gross: String(entry.grossCents),
      discount: entry.discountCents > 0 ? String(entry.discountCents) : "",
      categoryId: entry.categoryId ?? null,
      paymentMethodId: entry.paymentMethodId ?? null,
      tagIds: entry.tags.map((t) => t.tagId),
    });
    router.push("/recurring");
  };

  const handleIncomeRepeat = (entry: typeof incomeEntries[number]) => {
    writeRecurringPrefill({
      kind: "INCOME",
      dayOfMonth: entry.date.getDate(),
      description: entry.description ?? "",
      revenue: String(entry.revenueCents),
      cost: entry.costCents > 0 ? String(entry.costCents) : "",
      cardId: entry.cardId ?? null,
    });
    router.push("/recurring");
  };

  const handleSpendDelete = async (entryId: string) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this spend entry?");
      if (!confirmed) {
        return;
      }
    }
    await deleteTransaction.mutateAsync({ id: entryId });
    if (spendEditingId === entryId) {
      setSpendEditingId(null);
    }
  };

  const handleIncomeDelete = async (entryId: string) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this income entry?");
      if (!confirmed) {
        return;
      }
    }
    await deleteIncome.mutateAsync({ id: entryId });
    if (incomeEditingId === entryId) {
      setIncomeEditingId(null);
    }
  };

  return (
    <section className="surface-panel p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 rounded-full bg-surface-soft p-1 text-sm">
          {[
            { id: "spend", label: "Spend" },
            { id: "income", label: "Income" },
          ].map((item) => {
            const isActive = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => changeMode(item.id as "spend" | "income")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted">{entryCount} entries</p>
      </div>

      <div className="mt-6 border-y border-line py-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.6fr)]">
          <div>
            <label className="text-sm font-medium text-ink-soft">Search</label>
            <input
              aria-label="Search entries"
              className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-2 text-base transition focus:border-accent"
              placeholder={mode === "spend" ? "Merchant or notes" : "Description or source"}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPagination();
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-soft">Month</label>
            <MonthYearPicker value={selectedMonth} groups={monthGroups} onSelect={applyMonthSelection} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            aria-expanded={advancedOpen}
            aria-controls="review-advanced-filters"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-surface-soft hover:text-ink"
          >
            Advanced{advancedFilterCount ? ` · ${advancedFilterCount}` : ""}
          </button>
          {advancedFilterCount ? (
            <button type="button" onClick={resetFilters} className="rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-surface-soft hover:text-ink">
              Reset
            </button>
          ) : null}
        </div>

        {advancedOpen ? (
          <div id="review-advanced-filters" className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
            <ReviewFilterField label="From">
              <input
                type="date"
                aria-label="From date"
                className="mt-2 w-full rounded-xl border border-line px-4 py-2 text-base text-ink transition focus:border-accent"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setSelectedMonth("");
                  resetPagination();
                }}
              />
            </ReviewFilterField>
            <ReviewFilterField label="To">
              <input
                type="date"
                aria-label="To date"
                className="mt-2 w-full rounded-xl border border-line px-4 py-2 text-base text-ink transition focus:border-accent"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setSelectedMonth("");
                  resetPagination();
                }}
              />
            </ReviewFilterField>

            {mode === "spend" ? (
              <>
                <ReviewFilterField label="Category">
                  <select aria-label="Category" className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-2 text-base text-ink focus:border-accent" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); resetPagination(); }}>
                    <option value="">All categories</option>
                    {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </ReviewFilterField>
                <ReviewFilterField label="Payment">
                  <select aria-label="Payment method" className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-2 text-base text-ink focus:border-accent" value={paymentMethodId} onChange={(event) => { setPaymentMethodId(event.target.value); resetPagination(); }}>
                    <option value="">All methods</option>
                    {paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </ReviewFilterField>
                <ReviewFilterField label="Min amount">
                  <input inputMode="numeric" aria-label="Minimum amount" className="mt-2 w-full rounded-xl border border-line px-4 py-2 text-base focus:border-accent" placeholder="0" value={formatDigits(minNetInput)} onChange={(event) => { setMinNetInput(sanitizeNumber(event.target.value)); resetPagination(); }} />
                </ReviewFilterField>
                <ReviewFilterField label="Max amount">
                  <input inputMode="numeric" aria-label="Maximum amount" className="mt-2 w-full rounded-xl border border-line px-4 py-2 text-base focus:border-accent" placeholder="0" value={formatDigits(maxNetInput)} onChange={(event) => { setMaxNetInput(sanitizeNumber(event.target.value)); resetPagination(); }} />
                </ReviewFilterField>
                <ReviewFilterField label="Tags" className="md:col-span-2">
                  <button type="button" onClick={() => setTagSheetOpen(true)} className="mt-2 flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-2 text-sm text-ink transition hover:border-line-strong">
                    <span>{tagSummary}</span><span className="text-sm text-muted">Choose</span>
                  </button>
                </ReviewFilterField>
              </>
            ) : (
              <ReviewFilterField label="Card">
                <select aria-label="Card" className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-2 text-base text-ink focus:border-accent" value={cardId} onChange={(event) => { setCardId(event.target.value); resetPagination(); }}>
                  <option value="">All cards</option>
                  {cards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </ReviewFilterField>
            )}
          </div>
        ) : null}
      </div>

      {mode === "spend" ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { label: "Gross", value: summary.grossCents, tone: "text-ink" },
            { label: "Saved", value: summary.discountCents, tone: "text-income" },
            { label: "Paid", value: summary.netCents, tone: "text-ink" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl bg-surface-soft/65 px-4 py-3"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                {item.label}
              </p>
              <p className={`financial-number mt-1 text-lg font-semibold ${item.tone}`}>
                {summaryPending ? "₩—" : `₩${formatter.format(item.value)}`}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-surface-soft/65 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Revenue
            </p>
            <p
              className="financial-number mt-1 text-lg font-semibold text-income"
            >
              {summaryPending ? "₩—" : `₩${formatter.format(incomeSummary.revenueCents)}`}
            </p>
          </div>
          <div className="rounded-xl bg-surface-soft/65 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Cost
            </p>
            <p
              className="financial-number mt-1 text-lg font-semibold text-expense"
            >
              {summaryPending ? "₩—" : `₩${formatter.format(incomeSummary.costCents)}`}
            </p>
          </div>
          <div className="rounded-xl bg-surface-soft/65 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Net
            </p>
            <p
              className="financial-number mt-1 text-lg font-semibold"
              style={{ color: formatSignedAmount(incomeSummary.netCents).color }}
            >
              {summaryPending ? "₩—" : formatSignedAmount(incomeSummary.netCents).label}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted">Loading entries...</p>
        ) : error ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-danger/5 px-4 py-3">
            <p className="text-sm text-danger">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void (mode === "spend" ? spendQuery.refetch() : incomeQuery.refetch())}
              className="rounded-lg px-3 text-sm font-semibold text-danger hover:bg-white"
            >
              Retry
            </button>
          </div>
        ) : entryCount === 0 ? (
          <p className="text-sm text-muted">{emptyMessage}</p>
        ) : mode === "spend" ? (
          spendGroups.map((group) => (
            <div key={group.date} className="space-y-3">
              <div className="flex items-center justify-between px-1 text-xs uppercase tracking-[0.2em] text-muted">
                <span>{formatShortDateString(group.date)}</span>
                <span className="text-sm font-semibold text-ink">
                  ₩{formatter.format(group.total)}
                </span>
              </div>
              {group.entries.map((item) => {
                const isEditing = spendEditingId === item.id;
                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-line bg-surface px-4 py-3 transition hover:border-line-strong"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-ink">
                            {item.merchant || "Untitled purchase"}
                          </p>
                          {item.recurringRuleId ? (
                            <RecurringBadge
                              ruleId={item.recurringRuleId}
                              router={router}
                            />
                          ) : null}
                        </div>
                        <p className="text-xs text-muted">
                          {formatShortDate(item.date)} ·{" "}
                          {item.category?.name ?? "Uncategorized"} ·{" "}
                          {item.paymentMethod?.name ?? "Unknown payment"}
                        </p>
                        {item.notes ? (
                          <p className="mt-0.5 text-xs text-muted italic">
                            {item.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="financial-number text-lg font-semibold text-ink">₩{formatter.format(item.netCents)}</p>
                          {item.discountCents > 0 ? <p className="text-xs text-muted">Saved ₩{formatter.format(item.discountCents)}</p> : null}
                        </div>
                        <button
                          type="button"
                          aria-expanded={isEditing}
                          onClick={() => toggleSpendEdit(item)}
                          className="rounded-lg border border-line px-3 text-sm font-medium text-muted transition hover:border-line-strong hover:text-ink"
                        >
                          {isEditing ? "Close" : "Edit"}
                        </button>
                      </div>
                    </div>
                    {isEditing ? (
                      <div
                        className="mt-4 border-t border-line pt-4"
                        onClick={(event) => event.stopPropagation()}
                        role="presentation"
                      >
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="md:col-span-2">
                            <label className="text-xs uppercase tracking-[0.2em] text-muted">
                              Merchant
                            </label>
                            <input
                              aria-label="Merchant"
                              className="mt-2 w-full rounded-2xl border border-line px-4 py-2 text-base transition focus:border-accent sm:text-sm"
                              value={spendDraft.merchant}
                              onChange={(event) =>
                                setSpendDraft((prev) => ({
                                  ...prev,
                                  merchant: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-xs uppercase tracking-[0.2em] text-muted">
                              Date
                            </label>
                            <input
                              type="date"
                              aria-label="Date"
                              className="mt-2 w-full rounded-2xl border border-line px-4 py-2 text-base transition focus:border-accent sm:text-sm"
                              value={spendDraft.date}
                              onChange={(event) =>
                                setSpendDraft((prev) => ({
                                  ...prev,
                                  date: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-xs uppercase tracking-[0.2em] text-muted">
                              Amount
                            </label>
                            <input
                              inputMode="numeric"
                              aria-label="Amount"
                              className="mt-2 w-full rounded-2xl border border-line px-4 py-2 text-base transition focus:border-accent sm:text-sm"
                              value={formatDigits(spendDraft.gross)}
                              onChange={(event) =>
                                setSpendDraft((prev) => ({
                                  ...prev,
                                  gross: sanitizeNumber(event.target.value),
                                }))
                              }
                            />
                          </div>
                          <DiscountInput
                            className="md:col-span-2"
                            compact
                            grossValue={spendDraft.gross}
                            discountValue={spendDraft.discount}
                            onValueChange={(value, meta) => {
                              setSpendDraft((prev) =>
                                prev.discount === value
                                  ? prev
                                  : { ...prev, discount: value }
                              );
                              setSpendDiscountCalculationError(meta.error);
                            }}
                          />
                          <div className="grid gap-3 md:col-span-3 md:grid-cols-2">
                            <div>
                              <label className="text-xs uppercase tracking-[0.2em] text-muted">
                                Category
                              </label>
                              <select
                                aria-label="Category"
                                className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-2 text-sm text-ink transition focus:border-accent"
                                value={spendDraft.categoryId}
                                onChange={(event) =>
                                  setSpendDraft((prev) => ({
                                    ...prev,
                                    categoryId: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Uncategorized</option>
                                {categories.map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs uppercase tracking-[0.2em] text-muted">
                                Payment Method
                              </label>
                              <select
                                aria-label="Payment method"
                                className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-2 text-sm text-ink transition focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-muted"
                                value={spendDraft.paymentMethodId}
                                disabled={paymentMethodsQuery.isLoading}
                                onChange={(event) =>
                                  setSpendDraft((prev) => ({
                                    ...prev,
                                    paymentMethodId: event.target.value,
                                  }))
                                }
                              >
                                <option value="">No payment method</option>
                                {paymentMethods.map((paymentMethod) => (
                                  <option
                                    key={paymentMethod.id}
                                    value={paymentMethod.id}
                                  >
                                    {paymentMethod.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-xs uppercase tracking-[0.2em] text-muted">
                              Notes
                            </label>
                            <input
                              aria-label="Notes"
                              className="mt-2 w-full rounded-2xl border border-line px-4 py-2 text-base transition focus:border-accent sm:text-sm"
                              placeholder="Optional"
                              value={spendDraft.notes}
                              onChange={(event) =>
                                setSpendDraft((prev) => ({
                                  ...prev,
                                  notes: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-xs uppercase tracking-[0.2em] text-muted">
                              Tags
                            </label>
                            <button
                              type="button"
                              aria-label="Edit tags"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSpendEditTagSheetOpen(true);
                              }}
                              className="mt-2 flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-2 text-sm text-ink transition hover:border-line-strong"
                            >
                              <span>
                                {spendDraft.tagIds.length === 0
                                  ? "No tags"
                                  : tags
                                      .filter((t) => spendDraft.tagIds.includes(t.id))
                                      .map((t) => t.name)
                                      .join(", ")}
                              </span>
                              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                                Edit
                              </span>
                            </button>
                          </div>
                        </div>
                        {spendEditError ? (
                          <p role="alert" className="mt-3 text-sm text-danger">
                            {spendEditError}
                          </p>
                        ) : null}
                        <div className="sticky bottom-2 z-10 mt-4 flex items-center justify-end gap-2 rounded-xl border border-line bg-surface/95 p-2 shadow-[0_10px_24px_rgba(24,33,28,0.12)]">
                          <EntryActionMenu
                            onDuplicate={() => handleSpendDuplicate(item)}
                            onRepeat={() => handleSpendRepeat(item)}
                            onDelete={() => void handleSpendDelete(item.id)}
                          />
                          <button
                            type="button"
                            onClick={() => setSpendEditingId(null)}
                            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-line-strong hover:text-ink"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSpendSave(item.id)}
                            disabled={updateTransaction.isPending}
                            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:bg-muted"
                          >
                            {updateTransaction.isPending ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ))
        ) : (
          incomeGroups.map((group) => {
            const total = formatSignedAmount(group.total);
            return (
              <div key={group.date} className="space-y-3">
                <div className="flex items-center justify-between px-1 text-xs uppercase tracking-[0.2em] text-muted">
                  <span>{formatShortDateString(group.date)}</span>
                  <span className="text-sm font-semibold" style={{ color: total.color }}>
                    {total.label}
                  </span>
                </div>
                {group.entries.map((item) => {
                  const isEditing = incomeEditingId === item.id;
                  const net = item.revenueCents - item.costCents;
                  const netAmount = formatSignedAmount(net);
                  const dateLabel = formatShortDate(item.date);
                  const metaLabel = item.card?.name
                    ? `${dateLabel} · ${item.card.name}`
                    : dateLabel;
                  const revenueLabel = `+₩${formatter.format(item.revenueCents)}`;
                  const costLabel = `-₩${formatter.format(item.costCents)}`;
                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-line bg-surface px-4 py-3 transition hover:border-line-strong"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-ink">
                              {item.description}
                            </p>
                            {item.recurringRuleId ? (
                              <RecurringBadge
                                ruleId={item.recurringRuleId}
                                router={router}
                              />
                            ) : null}
                          </div>
                          <p className="text-xs text-muted">{metaLabel}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="financial-number text-lg font-semibold" style={{ color: netAmount.color }}>{netAmount.label}</p>
                            {item.costCents > 0 ? <p className="text-xs text-muted">
                              <span style={{ color: "rgba(22, 163, 74, 0.8)" }}>
                                {revenueLabel}
                              </span>
                              <span style={{ color: "#d4d4d8" }}> · </span>
                              <span style={{ color: "rgba(244, 63, 94, 0.8)" }}>
                                {costLabel}
                              </span>
                            </p> : null}
                          </div>
                          <button
                            type="button"
                            aria-expanded={isEditing}
                            onClick={() => toggleIncomeEdit(item)}
                            className="rounded-lg border border-line px-3 text-sm font-medium text-muted transition hover:border-line-strong hover:text-ink"
                          >
                            {isEditing ? "Close" : "Edit"}
                          </button>
                        </div>
                      </div>
                      {isEditing ? (
                        <div
                          className="mt-4 border-t border-line pt-4"
                          onClick={(event) => event.stopPropagation()}
                          role="presentation"
                        >
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="md:col-span-2">
                              <label className="text-xs uppercase tracking-[0.2em] text-muted">
                                Description
                              </label>
                              <input
                                aria-label="Description"
                                className="mt-2 w-full rounded-2xl border border-line px-4 py-2 text-base transition focus:border-accent sm:text-sm"
                                value={incomeDraft.description}
                                onChange={(event) =>
                                  setIncomeDraft((prev) => ({
                                    ...prev,
                                    description: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs uppercase tracking-[0.2em] text-muted">
                                Date
                              </label>
                              <input
                                type="date"
                                aria-label="Date"
                                className="mt-2 w-full rounded-2xl border border-line px-4 py-2 text-base transition focus:border-accent sm:text-sm"
                                value={incomeDraft.date}
                                onChange={(event) =>
                                  setIncomeDraft((prev) => ({
                                    ...prev,
                                    date: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs uppercase tracking-[0.2em] text-muted">
                                Revenue
                              </label>
                              <input
                                inputMode="numeric"
                                aria-label="Revenue"
                                className="mt-2 w-full rounded-2xl border border-line px-4 py-2 text-base transition focus:border-accent sm:text-sm"
                                value={formatDigits(incomeDraft.revenue)}
                                onChange={(event) =>
                                  setIncomeDraft((prev) => ({
                                    ...prev,
                                    revenue: sanitizeNumber(event.target.value),
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs uppercase tracking-[0.2em] text-muted">
                                Cost
                              </label>
                              <input
                                inputMode="numeric"
                                aria-label="Cost"
                                className="mt-2 w-full rounded-2xl border border-line px-4 py-2 text-base transition focus:border-accent sm:text-sm"
                                value={formatDigits(incomeDraft.cost)}
                                onChange={(event) =>
                                  setIncomeDraft((prev) => ({
                                    ...prev,
                                    cost: sanitizeNumber(event.target.value),
                                  }))
                                }
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-xs uppercase tracking-[0.2em] text-muted">
                                Card
                              </label>
                              <select
                                aria-label="Card"
                                className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-2 text-sm text-ink transition focus:border-accent"
                                value={incomeDraft.cardId}
                                onChange={(event) =>
                                  setIncomeDraft((prev) => ({
                                    ...prev,
                                    cardId: event.target.value,
                                  }))
                                }
                              >
                                <option value="">No card</option>
                                {cards.map((card) => (
                                  <option key={card.id} value={card.id}>
                                    {card.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {incomeEditError ? (
                            <p role="alert" className="mt-3 text-sm text-danger">
                              {incomeEditError}
                            </p>
                          ) : null}
                          <div className="sticky bottom-2 z-10 mt-4 flex items-center justify-end gap-2 rounded-xl border border-line bg-surface/95 p-2 shadow-[0_10px_24px_rgba(24,33,28,0.12)]">
                            <EntryActionMenu
                              onDuplicate={() => handleIncomeDuplicate(item)}
                              onRepeat={() => handleIncomeRepeat(item)}
                              onDelete={() => void handleIncomeDelete(item.id)}
                            />
                            <button
                              type="button"
                              onClick={() => setIncomeEditingId(null)}
                              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-line-strong hover:text-ink"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleIncomeSave(item.id)}
                              disabled={updateIncome.isPending}
                              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:bg-muted"
                            >
                              {updateIncome.isPending ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {canLoadMore && !isLoading && !error ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-ink"
          >
            Load more
          </button>
        </div>
      ) : null}

      <MultiSelectionSheet
        open={tagSheetOpen}
        title="Tags"
        items={[
          { id: "untagged", label: "No tags" },
          ...tags.map((tag) => ({ id: tag.id, label: tag.name })),
        ]}
        selectedIds={
          includeUntagged ? ["untagged", ...selectedTagIds] : selectedTagIds
        }
        onClose={() => setTagSheetOpen(false)}
        onToggle={(id) => {
          resetPagination();
          if (id === "untagged") {
            setIncludeUntagged((prev) => !prev);
            return;
          }
          setSelectedTagIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
          );
        }}
        onClear={() => {
          resetPagination();
          setSelectedTagIds([]);
          setIncludeUntagged(false);
        }}
        clearLabel="Clear tags"
      />
      <MultiSelectionSheet
        open={spendEditTagSheetOpen}
        title="Tags"
        items={tags.map((tag) => ({ id: tag.id, label: tag.name }))}
        selectedIds={spendDraft.tagIds}
        onClose={() => setSpendEditTagSheetOpen(false)}
        onToggle={(id) =>
          setSpendDraft((prev) => ({
            ...prev,
            tagIds: prev.tagIds.includes(id)
              ? prev.tagIds.filter((t) => t !== id)
              : [...prev.tagIds, id],
          }))
        }
        onClear={() => setSpendDraft((prev) => ({ ...prev, tagIds: [] }))}
        clearLabel="Clear tags"
        onCreate={async (name) => { await createTag.mutateAsync({ name }); }}
        createLabel="Add new tag"
      />
    </section>
  );
}

function ReviewFilterField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <p className="text-sm font-medium text-ink-soft">{label}</p>
      {children}
    </div>
  );
}

function EntryActionMenu({
  onDuplicate,
  onRepeat,
  onDelete,
}: {
  onDuplicate: () => void;
  onRepeat: () => void;
  onDelete: () => void;
}) {
  return (
    <details className="group relative mr-auto">
      <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-line px-4 text-sm font-semibold text-muted transition hover:border-line-strong hover:text-ink">
        More
      </summary>
      <div className="absolute bottom-full left-0 z-20 mb-2 min-w-40 rounded-xl border border-line bg-surface p-1 shadow-lg">
        <button type="button" onClick={onDuplicate} className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-surface-soft">
          Duplicate
        </button>
        <button type="button" onClick={onRepeat} className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-surface-soft">
          Repeat
        </button>
        <button type="button" onClick={onDelete} className="w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/5">
          Delete
        </button>
      </div>
    </details>
  );
}

function RecurringBadge({
  ruleId,
  router,
}: {
  ruleId: string;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <button
      type="button"
      title="From a recurring rule — view it"
      aria-label="View recurring rule"
      onClick={(event) => {
        event.stopPropagation();
        router.push(`/recurring?rule=${ruleId}`);
      }}
      className="text-muted transition hover:text-ink"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      </svg>
    </button>
  );
}
