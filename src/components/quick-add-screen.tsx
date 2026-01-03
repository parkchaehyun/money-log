"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { trpc } from "@/trpc/react";

import { MultiSelectionSheet } from "./multi-selection-sheet";
import { PaymentSelectionSheet } from "./payment-selection-sheet";
import { SelectionSheet } from "./selection-sheet";

const formatter = new Intl.NumberFormat("ko-KR");
const CASH_METHOD_NAME = "Cash";
const recentCategoryKey = "money-log:recentCategories";
const recentPaymentKey = "money-log:recentPaymentMethods";
const recentTagKey = "money-log:recentTags";

const formatLocalDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatShortDate = (value: string) => {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${year.slice(-2)}.${month}.${day}`;
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

const isDefined = <T,>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

const readStoredList = (key: string) => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredList = (key: string, value: string[]) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures (private mode, quota).
  }
};

export function QuickAddScreen() {
  const utils = trpc.useUtils();
  const [date, setDate] = useState(() => formatLocalDate(new Date()));
  const [amountInput, setAmountInput] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [recentCategoryIds, setRecentCategoryIds] = useState<string[]>([]);
  const [recentPaymentIds, setRecentPaymentIds] = useState<string[]>([]);
  const [recentTagIds, setRecentTagIds] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"info" | "error">("info");
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null
  );
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [hasEnsuredCash, setHasEnsuredCash] = useState(false);

  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = trpc.categories.list.useQuery();
  const {
    data: paymentMethodsData,
    isLoading: paymentMethodsLoading,
    error: paymentMethodsError,
  } = trpc.paymentMethods.list.useQuery();
  const {
    data: tagsData,
    isLoading: tagsLoading,
    error: tagsError,
  } = trpc.tags.list.useQuery();

  const grossValue = Number.parseInt(amountInput || "0", 10) || 0;
  const discountValue =
    discountEnabled && discountInput
      ? Number.parseInt(discountInput || "0", 10) || 0
      : 0;
  const paidValue = Math.max(0, grossValue - discountValue);
  const amountError =
    amountTouched && grossValue <= 0 ? "Enter an amount." : null;
  const discountError =
    discountEnabled && grossValue > 0 && discountValue > grossValue
      ? "Discount cannot exceed price."
      : null;

  const createTransaction = trpc.transactions.create.useMutation({
    onSuccess: async () => {
      setStatus(null);
      setToast({ id: Date.now(), message: "Entry saved" });
      setAmountInput("");
      setAmountTouched(false);
      setDiscountInput("");
      setDiscountEnabled(false);
      setMerchant("");
      setNotes("");
      setShowNotes(false);
      setSelectedTagIds([]);
      if (categoryId) {
        const nextRecentCategories = [
          categoryId,
          ...recentCategoryIds.filter((id) => id !== categoryId),
        ].slice(0, 3);
        setRecentCategoryIds(nextRecentCategories);
        writeStoredList(recentCategoryKey, nextRecentCategories);
      }
      if (paymentMethodId) {
        const nextRecentPayments = [
          paymentMethodId,
          ...recentPaymentIds.filter((id) => id !== paymentMethodId),
        ].slice(0, 3);
        setRecentPaymentIds(nextRecentPayments);
        writeStoredList(recentPaymentKey, nextRecentPayments);
      }
      if (selectedTagIds.length) {
        const nextRecentTags = [
          ...selectedTagIds,
          ...recentTagIds.filter((id) => !selectedTagIds.includes(id)),
        ].slice(0, 5);
        setRecentTagIds(nextRecentTags);
        writeStoredList(recentTagKey, nextRecentTags);
      }
      await utils.transactions.list.invalidate();
      await utils.transactions.summary.invalidate();
    },
    onError: (error) => {
      setStatusTone("error");
      const message =
        error.data?.zodError?.fieldErrors?.grossCents?.[0] ??
        error.data?.zodError?.fieldErrors?.discountCents?.[0] ??
        error.message ??
        "Unable to save. Please try again.";
      setStatus(message);
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    },
  });

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 2200);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [toast]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    setPortalTarget(document.body);
  }, []);

  const createCategory = trpc.categories.create.useMutation({
    onSuccess: async (data) => {
      await utils.categories.list.invalidate();
      setCategoryId(data.id);
    },
  });

  const createCard = trpc.cards.create.useMutation({
    onSuccess: async () => {
      await utils.cards.list.invalidate();
    },
  });

  const createPaymentMethod = trpc.paymentMethods.create.useMutation({
    onSuccess: async (data) => {
      await utils.paymentMethods.list.invalidate();
      setPaymentMethodId(data.id);
    },
  });

  const ensureCashMethod = trpc.paymentMethods.create.useMutation({
    onSuccess: async () => {
      await utils.paymentMethods.list.invalidate();
    },
  });

  const createTag = trpc.tags.create.useMutation({
    onSuccess: async (data) => {
      await utils.tags.list.invalidate();
      setSelectedTagIds((prev) =>
        prev.includes(data.id) ? prev : [data.id, ...prev]
      );
    },
  });

  const categories = useMemo(
    () => (Array.isArray(categoriesData) ? categoriesData : []),
    [categoriesData]
  );
  const paymentMethods = useMemo(
    () => (Array.isArray(paymentMethodsData) ? paymentMethodsData : []),
    [paymentMethodsData]
  );
  const tags = useMemo(() => (Array.isArray(tagsData) ? tagsData : []), [tagsData]);
  const cashMethod = useMemo(
    () => paymentMethods.find((item) => item.type === "CASH_TRANSFER"),
    [paymentMethods]
  );
  const cardPaymentMethods = useMemo(
    () => paymentMethods.filter((item) => item.type !== "CASH_TRANSFER"),
    [paymentMethods]
  );

  useEffect(() => {
    setRecentCategoryIds(readStoredList(recentCategoryKey));
    setRecentPaymentIds(readStoredList(recentPaymentKey));
    setRecentTagIds(readStoredList(recentTagKey));
  }, []);

  useEffect(() => {
    if (paymentMethodsLoading || hasEnsuredCash || ensureCashMethod.isPending) {
      return;
    }
    if (!cashMethod) {
      setHasEnsuredCash(true);
      ensureCashMethod.mutate({
        name: CASH_METHOD_NAME,
        type: "CASH_TRANSFER",
      });
    }
  }, [
    cashMethod,
    ensureCashMethod,
    hasEnsuredCash,
    paymentMethodsLoading,
  ]);

  const recentCategories = useMemo(
    () =>
      recentCategoryIds
        .map((id) => categories.find((item) => item.id === id))
        .filter(isDefined)
        .slice(0, 3),
    [categories, recentCategoryIds]
  );

  const recentPayments = useMemo(
    () =>
      recentPaymentIds
        .map((id) => paymentMethods.find((item) => item.id === id))
        .filter(isDefined)
        .slice(0, 3),
    [paymentMethods, recentPaymentIds]
  );

  const recentTags = useMemo(
    () =>
      recentTagIds
        .map((id) => tags.find((item) => item.id === id))
        .filter(isDefined)
        .slice(0, 5),
    [recentTagIds, tags]
  );

  const selectedTags = useMemo(
    () =>
      selectedTagIds
        .map((id) => tags.find((item) => item.id === id))
        .filter(isDefined),
    [selectedTagIds, tags]
  );

  const recentTagChoices = useMemo(
    () => recentTags.filter((item) => !selectedTagIds.includes(item.id)),
    [recentTags, selectedTagIds]
  );

  const categoryChoices = useMemo(() => {
    const exclude = new Set(recentCategories.map((item) => item.id));
    const next = categories.filter((item) => !exclude.has(item.id));
    let choices = [...recentCategories, ...next].slice(0, 6);
    if (categoryId) {
      const selected = categories.find((item) => item.id === categoryId);
      if (selected && !choices.some((item) => item.id === selected.id)) {
        choices = [selected, ...choices.slice(0, 5)];
      }
    }
    return choices;
  }, [categories, categoryId, recentCategories]);

  const paymentChoices = useMemo(() => {
    const recent = recentPayments.filter((item) => item.id !== cashMethod?.id);
    const exclude = new Set(recent.map((item) => item.id));
    const next = cardPaymentMethods.filter((item) => !exclude.has(item.id));
    const cardChoices = [...recent, ...next].slice(0, cashMethod ? 3 : 4);
    let choices = cashMethod ? [...cardChoices, cashMethod] : cardChoices;
    if (paymentMethodId) {
      const selected = paymentMethods.find((item) => item.id === paymentMethodId);
      if (selected && !choices.some((item) => item.id === selected.id)) {
        choices = [selected, ...choices.slice(0, choices.length - 1)];
      }
    }
    return choices;
  }, [
    cardPaymentMethods,
    cashMethod,
    paymentMethodId,
    paymentMethods,
    recentPayments,
  ]);

  const categoryItems = categories.map((item) => ({
    id: item.id,
    label: item.name,
  }));

  const paymentItems = [
    ...(cashMethod
      ? [
          {
            id: cashMethod.id,
            label: cashMethod.name,
            subLabel: null,
            type: cashMethod.type,
          },
        ]
      : []),
    ...cardPaymentMethods.map((item) => ({
      id: item.id,
      label: item.name,
      subLabel:
        item.card?.name && item.card.name !== item.name
          ? item.card.name
          : null,
      type: item.type,
    })),
  ];

  const tagItems = tags.map((item) => ({
    id: item.id,
    label: item.name,
  }));

  const canSubmit =
    grossValue > 0 &&
    discountValue >= 0 &&
    !discountError &&
    !createTransaction.isPending;

  const handleSave = () => {
    const parsedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      setStatusTone("error");
      setStatus("Please choose a valid date.");
      return;
    }
    if (grossValue <= 0) {
      setAmountTouched(true);
      return;
    }
    if (discountError) {
      return;
    }
    createTransaction.mutate({
      date: parsedDate,
      merchant: merchant.trim() || null,
      notes: notes.trim() || null,
      grossCents: grossValue,
      discountCents: discountValue,
      categoryId,
      paymentMethodId,
      tagIds: selectedTagIds.length ? selectedTagIds : undefined,
    });
  };

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
      {toast && portalTarget
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-6"
              style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            >
              <div
                role="status"
                aria-live="polite"
                className="rounded-full px-4 py-2 text-sm font-semibold shadow-lg"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  boxShadow: "0 10px 24px rgba(16, 163, 74, 0.25)",
                }}
              >
                <span
                  className="rounded-full"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    flex: "0 0 20px",
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="h-3.5 w-3.5"
                    width="14"
                    height="14"
                  >
                    <path
                      d="M5 10.5l3 3L15 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span style={{ whiteSpace: "nowrap" }}>{toast.message}</span>
              </div>
            </div>,
            portalTarget
          )
        : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          <span>Date</span>
          <div className="relative">
            <span className="text-base font-medium tabular-nums text-zinc-900 sm:text-sm">
              {formatShortDate(date)}
            </span>
            <input
              type="date"
              aria-label="Select date"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSave}
          className="rounded-2xl bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {createTransaction.isPending ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            Amount
          </label>
          <button
            type="button"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            onClick={() => {
              if (discountEnabled) {
                setDiscountEnabled(false);
                setDiscountInput("");
                return;
              }
              setDiscountEnabled(true);
              setDiscountInput("");
            }}
          >
            {discountEnabled ? "Remove discount" : "+ Discount"}
          </button>
        </div>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-zinc-400">
            ₩
          </span>
          <input
            inputMode="numeric"
            className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-lg font-semibold text-zinc-900 outline-none transition focus:border-zinc-900"
            placeholder="0"
            value={formatDigits(amountInput)}
            onChange={(event) =>
              setAmountInput(sanitizeNumber(event.target.value))
            }
            onBlur={() => setAmountTouched(true)}
          />
        </div>
        {amountError ? (
          <p className="mt-2 text-sm text-red-600">{amountError}</p>
        ) : null}
        {discountEnabled ? (
          <div className="mt-4">
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Discount
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400">
                ₩
              </span>
              <input
                inputMode="numeric"
                className="w-full rounded-2xl border border-zinc-200 bg-white py-2 pl-9 pr-4 text-base font-semibold text-zinc-900 outline-none transition focus:border-zinc-900"
                placeholder="0"
                value={formatDigits(discountInput)}
                onChange={(event) =>
                  setDiscountInput(sanitizeNumber(event.target.value))
                }
              />
            </div>
            {discountError ? (
              <p className="mt-2 text-sm text-red-600">{discountError}</p>
            ) : null}
            {grossValue > 0 ? (
              <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-400">
                <span>Paid</span>
                <span className="text-sm font-semibold text-zinc-900">
                  ₩{formatter.format(paidValue)}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
          Merchant
        </label>
        <input
          className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
          placeholder="Store or description"
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Category
            </p>
            <button
              type="button"
              aria-label="Open category picker"
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              onClick={() => setCategorySheetOpen(true)}
            >
              +
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categoriesLoading ? (
              <span className="text-sm text-zinc-400">Loading...</span>
            ) : categoriesError ? (
              <span className="text-sm text-red-500">Failed to load.</span>
            ) : (
              categoryChoices.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setCategoryId((prev) => (prev === item.id ? null : item.id))
                  }
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    categoryId === item.id
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Payment
            </p>
            <button
              type="button"
              aria-label="Open payment picker"
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              onClick={() => setPaymentSheetOpen(true)}
            >
              +
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {paymentMethodsLoading ? (
              <span className="text-sm text-zinc-400">Loading...</span>
            ) : paymentMethodsError ? (
              <span className="text-sm text-red-500">Failed to load.</span>
            ) : (
              paymentChoices.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setPaymentMethodId((prev) =>
                      prev === item.id ? null : item.id
                    )
                  }
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    paymentMethodId === item.id
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        {selectedTagIds.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Tags
              </p>
              <button
                type="button"
                aria-label="Open tag picker"
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                onClick={() => setTagSheetOpen(true)}
              >
                +
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tagsLoading ? (
                <span className="text-sm text-zinc-400">Loading...</span>
              ) : tagsError ? (
                <span className="text-sm text-red-500">Failed to load.</span>
              ) : (
                <>
                  {selectedTags.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedTagIds((prev) =>
                          prev.filter((id) => id !== item.id)
                        )
                      }
                      className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
                    >
                      {item.name} ×
                    </button>
                  ))}
                  {recentTagChoices.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedTagIds((prev) => [...prev, item.id])
                      }
                      className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
                    >
                      {item.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            onClick={() => setTagSheetOpen(true)}
          >
            + Add tags
          </button>
        )}
      </div>

      <div className="mt-6">
        {showNotes || notes.trim() ? (
          <>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Notes
            </label>
            <textarea
              className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
              rows={2}
              placeholder="Optional note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </>
        ) : (
          <button
            type="button"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            onClick={() => setShowNotes(true)}
          >
            + Add note
          </button>
        )}
      </div>

      {status ? (
        <p
          className={`mt-4 text-sm ${
            statusTone === "error" ? "text-red-600" : "text-zinc-500"
          }`}
        >
          {status}
        </p>
      ) : null}

      <SelectionSheet
        open={categorySheetOpen}
        title="Category"
        items={categoryItems}
        selectedId={categoryId}
        onClose={() => setCategorySheetOpen(false)}
        onSelect={setCategoryId}
        onCreate={async (name) => {
          await createCategory.mutateAsync({ name });
        }}
        createLabel="Add new category"
      />

      <PaymentSelectionSheet
        open={paymentSheetOpen}
        items={paymentItems}
        selectedId={paymentMethodId}
        onClose={() => setPaymentSheetOpen(false)}
        onSelect={setPaymentMethodId}
        onCreate={async (name) => {
          const card = await createCard.mutateAsync({ name });
          await createPaymentMethod.mutateAsync({
            name: card.name,
            type: "CARD",
            cardId: card.id,
          });
        }}
      />

      <MultiSelectionSheet
        open={tagSheetOpen}
        title="Tags"
        items={tagItems}
        selectedIds={selectedTagIds}
        onClose={() => setTagSheetOpen(false)}
        onToggle={(id) =>
          setSelectedTagIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
          )
        }
        onCreate={async (name) => {
          await createTag.mutateAsync({ name });
        }}
        createLabel="Add new tag"
      />
    </section>
  );
}
