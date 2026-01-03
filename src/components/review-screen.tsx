"use client";

import { useEffect, useMemo, useState } from "react";

import { trpc } from "@/trpc/react";
import { MultiSelectionSheet } from "@/components/multi-selection-sheet";

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

const defaultToDate = () => formatLocalDate(new Date());

export function ReviewScreen() {
  const utils = trpc.useUtils();
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
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [spendTake, setSpendTake] = useState(60);
  const [incomeTake, setIncomeTake] = useState(60);
  const [spendEditingId, setSpendEditingId] = useState<string | null>(null);
  const [spendDraft, setSpendDraft] = useState({
    merchant: "",
    gross: "",
    discount: "",
  });
  const [spendEditError, setSpendEditError] = useState<string | null>(null);
  const [incomeEditingId, setIncomeEditingId] = useState<string | null>(null);
  const [incomeDraft, setIncomeDraft] = useState({
    description: "",
    revenue: "",
    cost: "",
    cardId: "",
  });
  const [incomeEditError, setIncomeEditError] = useState<string | null>(null);

  const fromValue = parseDateInput(fromDate);
  const toValue = parseDateInput(toDate, true);
  const searchValue = search.trim();
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

  const spendEntries = Array.isArray(spendQuery.data) ? spendQuery.data : [];
  const incomeEntries = Array.isArray(incomeQuery.data) ? incomeQuery.data : [];
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
      await utils.transactions.list.invalidate();
      await utils.transactions.summary.invalidate();
      setSpendEditingId(null);
    },
  });

  const deleteTransaction = trpc.transactions.delete.useMutation({
    onSuccess: async () => {
      await utils.transactions.list.invalidate();
      await utils.transactions.summary.invalidate();
    },
  });

  const updateIncome = trpc.income.update.useMutation({
    onSuccess: async () => {
      await utils.income.list.invalidate();
      setIncomeEditingId(null);
    },
  });

  const deleteIncome = trpc.income.delete.useMutation({
    onSuccess: async () => {
      await utils.income.list.invalidate();
    },
  });

  useEffect(() => {
    setSpendTake(60);
  }, [
    categoryId,
    fromDate,
    includeUntagged,
    maxNetInput,
    minNetInput,
    paymentMethodId,
    selectedTagIds,
    searchValue,
    toDate,
  ]);

  useEffect(() => {
    setIncomeTake(60);
  }, [cardId, fromDate, searchValue, toDate]);

  useEffect(() => {
    setSpendEditingId(null);
    setIncomeEditingId(null);
    setSpendEditError(null);
    setIncomeEditError(null);
  }, [mode]);

  const resetFilters = () => {
    setFromDate(defaultFromDate());
    setToDate(defaultToDate());
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
      return;
    }
    setSpendEditingId(entry.id);
    setSpendDraft({
      merchant: entry.merchant ?? "",
      gross: String(entry.grossCents),
      discount: String(entry.discountCents),
    });
    setSpendEditError(null);
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
    });
    setIncomeEditError(null);
  };

  const handleSpendSave = async (entryId: string) => {
    const grossCents = Number.parseInt(spendDraft.gross || "0", 10) || 0;
    const discountCents = Number.parseInt(spendDraft.discount || "0", 10) || 0;
    if (grossCents <= 0) {
      setSpendEditError("Enter an amount.");
      return;
    }
    if (discountCents > grossCents) {
      setSpendEditError("Discount cannot exceed amount.");
      return;
    }
    setSpendEditError(null);
    try {
      await updateTransaction.mutateAsync({
        id: entryId,
        merchant: spendDraft.merchant.trim() || null,
        grossCents,
        discountCents,
      });
    } catch {
      setSpendEditError("Unable to update entry.");
    }
  };

  const handleIncomeSave = async (entryId: string) => {
    const revenueCents = Number.parseInt(incomeDraft.revenue || "0", 10) || 0;
    const costCents = Number.parseInt(incomeDraft.cost || "0", 10) || 0;
    if (revenueCents <= 0 && costCents <= 0) {
      setIncomeEditError("Enter revenue or cost.");
      return;
    }
    if (!incomeDraft.description.trim()) {
      setIncomeEditError("Add a description.");
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
      });
    } catch {
      setIncomeEditError("Unable to update entry.");
    }
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
    <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
        <p className="text-sm text-zinc-500">{entryCount} entries</p>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Search
            </label>
            <input
              className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
              placeholder={
                mode === "spend"
                  ? "Merchant or notes"
                  : "Description or source"
              }
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              From
            </label>
            <input
              type="date"
              className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              To
            </label>
            <input
              type="date"
              className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>

          {mode === "spend" ? (
            <>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Category
                </label>
                <select
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">All categories</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Payment
                </label>
                <select
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
                  value={paymentMethodId}
                  onChange={(event) => setPaymentMethodId(event.target.value)}
                >
                  <option value="">All methods</option>
                  {paymentMethods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Min amount
                </label>
                <input
                  inputMode="numeric"
                  className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-sm outline-none transition focus:border-zinc-900"
                  placeholder="0"
                  value={formatDigits(minNetInput)}
                  onChange={(event) =>
                    setMinNetInput(sanitizeNumber(event.target.value))
                  }
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Max amount
                </label>
                <input
                  inputMode="numeric"
                  className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-sm outline-none transition focus:border-zinc-900"
                  placeholder="0"
                  value={formatDigits(maxNetInput)}
                  onChange={(event) =>
                    setMaxNetInput(sanitizeNumber(event.target.value))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    Tags
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setTagSheetOpen(true)}
                  className="mt-2 flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 transition hover:border-zinc-300"
                >
                  <span>{tagSummary}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    Edit
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Card
              </label>
              <select
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
                value={cardId}
                onChange={(event) => setCardId(event.target.value)}
              >
                <option value="">All cards</option>
                {cards.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400 transition hover:text-zinc-900"
            onClick={resetFilters}
          >
            Reset
          </button>
        </div>
      </div>

      {mode === "spend" ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { label: "Gross", value: summary.grossCents, color: "#111827" },
            { label: "Saved", value: summary.discountCents, color: "#16a34a" },
            { label: "Net", value: summary.netCents, color: "#111827" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-semibold" style={{ color: item.color }}>
                ₩{formatter.format(item.value)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Revenue
            </p>
            <p
              className="mt-1 text-lg font-semibold"
              style={{ color: "#16a34a" }}
            >
              ₩{formatter.format(incomeSummary.revenueCents)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Cost
            </p>
            <p
              className="mt-1 text-lg font-semibold"
              style={{ color: "#f43f5e" }}
            >
              ₩{formatter.format(incomeSummary.costCents)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Net
            </p>
            <p
              className="mt-1 text-lg font-semibold"
              style={{ color: formatSignedAmount(incomeSummary.netCents).color }}
            >
              {formatSignedAmount(incomeSummary.netCents).label}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading entries...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : entryCount === 0 ? (
          <p className="text-sm text-zinc-500">{emptyMessage}</p>
        ) : mode === "spend" ? (
          spendGroups.map((group) => (
            <div key={group.date} className="space-y-3">
              <div className="flex items-center justify-between px-1 text-xs uppercase tracking-[0.2em] text-zinc-400">
                <span>{formatShortDateString(group.date)}</span>
                <span className="text-sm font-semibold text-zinc-900">
                  ₩{formatter.format(group.total)}
                </span>
              </div>
              {group.entries.map((item) => {
                const isEditing = spendEditingId === item.id;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isEditing}
                    onClick={() => toggleSpendEdit(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleSpendEdit(item);
                      }
                    }}
                    className="cursor-pointer rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3 transition hover:border-zinc-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
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
                    {isEditing ? (
                      <div
                        className="mt-4 border-t border-zinc-200 pt-4"
                        onClick={(event) => event.stopPropagation()}
                        role="presentation"
                      >
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="md:col-span-2">
                            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                              Merchant
                            </label>
                            <input
                              className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
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
                            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                              Amount
                            </label>
                            <input
                              inputMode="numeric"
                              className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
                              value={formatDigits(spendDraft.gross)}
                              onChange={(event) =>
                                setSpendDraft((prev) => ({
                                  ...prev,
                                  gross: sanitizeNumber(event.target.value),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                              Discount
                            </label>
                            <input
                              inputMode="numeric"
                              className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
                              value={formatDigits(spendDraft.discount)}
                              onChange={(event) =>
                                setSpendDraft((prev) => ({
                                  ...prev,
                                  discount: sanitizeNumber(event.target.value),
                                }))
                              }
                            />
                          </div>
                        </div>
                        {spendEditError ? (
                          <p className="mt-3 text-sm text-red-600">
                            {spendEditError}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSpendEditingId(null);
                            }}
                            className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleSpendDelete(item.id);
                            }}
                            className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-300"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleSpendSave(item.id);
                            }}
                            disabled={updateTransaction.isPending}
                            className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          incomeGroups.map((group) => {
            const total = formatSignedAmount(group.total);
            return (
              <div key={group.date} className="space-y-3">
                <div className="flex items-center justify-between px-1 text-xs uppercase tracking-[0.2em] text-zinc-400">
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
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isEditing}
                      onClick={() => toggleIncomeEdit(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleIncomeEdit(item);
                        }
                      }}
                      className="cursor-pointer rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3 transition hover:border-zinc-200"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">
                            {item.description}
                          </p>
                          <p className="text-xs text-zinc-500">{metaLabel}</p>
                        </div>
                        <div className="text-right">
                          <p
                            className="text-lg font-semibold"
                            style={{ color: netAmount.color }}
                          >
                            {netAmount.label}
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
                      {isEditing ? (
                        <div
                          className="mt-4 border-t border-zinc-200 pt-4"
                          onClick={(event) => event.stopPropagation()}
                          role="presentation"
                        >
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="md:col-span-2">
                              <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                                Description
                              </label>
                              <input
                                className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
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
                              <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                                Revenue
                              </label>
                              <input
                                inputMode="numeric"
                                className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
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
                              <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                                Cost
                              </label>
                              <input
                                inputMode="numeric"
                                className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
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
                              <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                                Card
                              </label>
                              <select
                                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
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
                            <p className="mt-3 text-sm text-red-600">
                              {incomeEditError}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setIncomeEditingId(null);
                              }}
                              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleIncomeDelete(item.id);
                              }}
                              className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-300"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleIncomeSave(item.id);
                              }}
                              disabled={updateIncome.isPending}
                              className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
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
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
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
          if (id === "untagged") {
            setIncludeUntagged((prev) => !prev);
            return;
          }
          setSelectedTagIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
          );
        }}
        onClear={() => {
          setSelectedTagIds([]);
          setIncludeUntagged(false);
        }}
        clearLabel="Clear tags"
      />
    </section>
  );
}
