"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { trpc } from "@/trpc/react";
import { consumeSpendPrefill } from "@/lib/entry-prefill";

import { AutocompleteField } from "./autocomplete-field";
import { DiscountInput } from "./discount-input";
import { MultiSelectionSheet } from "./multi-selection-sheet";
import { PaymentSelectionSheet } from "./payment-selection-sheet";
import { SaveToast } from "./save-toast";
import { SelectionSheet } from "./selection-sheet";
import { CloseIcon, PlusIcon } from "./ui-icons";

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
  const [discountCalculationError, setDiscountCalculationError] = useState<
    string | null
  >(null);
  const [discountControlKey, setDiscountControlKey] = useState(0);
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

  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const cashEnsureAttemptedRef = useRef(false);

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
  const merchantOptionsQuery = trpc.transactions.merchantOptions.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );

  const grossValue = Number.parseInt(amountInput || "0", 10) || 0;
  const discountValue =
    discountEnabled && discountInput
      ? Number.parseInt(discountInput || "0", 10) || 0
      : 0;
  const amountError =
    amountTouched && grossValue <= 0 ? "Enter an amount." : null;
  const discountError = discountEnabled ? discountCalculationError : null;

  const createTransaction = trpc.transactions.create.useMutation({
    onSuccess: async () => {
      setStatus(null);
      setToast({ id: Date.now(), message: "Entry saved" });
      setAmountInput("");
      setAmountTouched(false);
      setDiscountInput("");
      setDiscountEnabled(false);
      setDiscountCalculationError(null);
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
      await Promise.all([
        utils.transactions.list.invalidate(),
        utils.transactions.summary.invalidate(),
        utils.transactions.merchantOptions.invalidate(),
        utils.dashboard.invalidate(),
      ]);
    },
    onError: (error) => {
      setStatusTone("error");
      const message =
        error.data?.zodError?.fieldErrors?.grossCents?.[0] ??
        error.data?.zodError?.fieldErrors?.discountCents?.[0] ??
        error.message ??
        "Unable to save. Please try again.";
      setStatus(message);
      if (process.env.NODE_ENV === "development") console.error(error);
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
    const frame = window.requestAnimationFrame(() => {
      setRecentCategoryIds(readStoredList(recentCategoryKey));
      setRecentPaymentIds(readStoredList(recentPaymentKey));
      setRecentTagIds(readStoredList(recentTagKey));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const prefill = consumeSpendPrefill();
    if (!prefill) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setAmountInput(prefill.amount);
      if (prefill.discount) {
        setDiscountEnabled(true);
        setDiscountInput(prefill.discount);
      }
      setMerchant(prefill.merchant);
      if (prefill.notes) {
        setShowNotes(true);
        setNotes(prefill.notes);
      }
      setCategoryId(prefill.categoryId);
      setPaymentMethodId(prefill.paymentMethodId);
      setSelectedTagIds(prefill.tagIds);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (
      paymentMethodsLoading ||
      cashEnsureAttemptedRef.current ||
      ensureCashMethod.isPending
    ) {
      return;
    }
    if (!cashMethod) {
      cashEnsureAttemptedRef.current = true;
      ensureCashMethod.mutate({
        name: CASH_METHOD_NAME,
        type: "CASH_TRANSFER",
      });
    }
  }, [
    cashMethod,
    ensureCashMethod,
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

  const merchantSuggestions = useMemo(
    () =>
      Array.isArray(merchantOptionsQuery.data)
        ? merchantOptionsQuery.data
        : [],
    [merchantOptionsQuery.data]
  );

  const applyMerchantSuggestion = (
    suggestion: (typeof merchantSuggestions)[number]
  ) => {
    setMerchant(suggestion.merchant);
    setCategoryId(suggestion.categoryId);
    setPaymentMethodId(suggestion.paymentMethodId);
    setSelectedTagIds(suggestion.tagIds);
    setAmountInput(String(suggestion.grossCents));
    if (suggestion.discountCents > 0) {
      setDiscountEnabled(true);
      setDiscountInput(String(suggestion.discountCents));
    } else {
      setDiscountEnabled(false);
      setDiscountInput("");
    }
    setDiscountCalculationError(null);
    setDiscountControlKey((value) => value + 1);
    // Amount varies most, so focus + select it for an immediate retype.
    requestAnimationFrame(() => {
      amountRef.current?.focus();
      amountRef.current?.select();
    });
  };

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
    <section className="surface-panel p-4 sm:p-6">
      <SaveToast message={toast?.message ?? null} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-soft/60 px-3 py-2 text-sm text-ink-soft">
          <span>Date</span>
          <div className="relative">
            <span className="financial-number text-base font-medium text-ink sm:text-sm">
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
          className="hidden rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:bg-muted sm:block"
        >
          {createTransaction.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface-soft/35 p-4">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-[0.2em] text-muted">
            Amount
          </label>
          <button
            type="button"
            className="text-xs font-semibold text-accent hover:text-accent-strong"
            onClick={() => {
              if (discountEnabled) {
                setDiscountEnabled(false);
                setDiscountInput("");
                setDiscountCalculationError(null);
                return;
              }
              setDiscountEnabled(true);
              setDiscountInput("");
              setDiscountCalculationError(null);
            }}
          >
            {discountEnabled ? "Remove discount" : "Discount"}
          </button>
        </div>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted">
            ₩
          </span>
          <input
            ref={amountRef}
            aria-label="Amount"
            aria-invalid={Boolean(amountError)}
            inputMode="numeric"
            className="financial-number w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-4 text-lg font-semibold text-ink transition focus:border-accent"
            placeholder="0"
            value={formatDigits(amountInput)}
            onChange={(event) =>
              setAmountInput(sanitizeNumber(event.target.value))
            }
            onBlur={() => setAmountTouched(true)}
          />
        </div>
        {amountError ? (
          <p className="mt-2 text-sm text-danger">{amountError}</p>
        ) : null}
        {discountEnabled ? (
          <DiscountInput
            key={discountControlKey}
            className="mt-4"
            grossValue={amountInput}
            discountValue={discountInput}
            onValueChange={(value, meta) => {
              setDiscountInput(value);
              setDiscountCalculationError(meta.error);
            }}
          />
        ) : null}
      </div>

      <div className="mt-6">
        <AutocompleteField
          label="Merchant"
          placeholder="Store or description"
          value={merchant}
          onChange={setMerchant}
          items={merchantSuggestions}
          onSelect={applyMerchantSuggestion}
          getKey={(item) => item.merchant}
          getPrimary={(item) => item.merchant}
          getSecondary={(item) => {
            const category = categories.find((c) => c.id === item.categoryId);
            const payment = paymentMethods.find(
              (p) => p.id === item.paymentMethodId
            );
            return (
              [category?.name, payment?.name].filter(Boolean).join(" · ") ||
              null
            );
          }}
          getTrailing={(item) => `₩${formatter.format(item.grossCents)}`}
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Category
            </p>
            <button
              type="button"
              aria-label="Open category picker"
              className="grid size-11 place-items-center rounded-full text-accent transition hover:bg-accent-soft hover:text-accent-strong"
              onClick={() => setCategorySheetOpen(true)}
            >
              <PlusIcon />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categoriesLoading ? (
              <span className="text-sm text-muted">Loading...</span>
            ) : categoriesError ? (
              <span className="text-sm text-danger">Failed to load.</span>
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
                      ? "bg-ink text-surface"
                      : "bg-surface-soft text-ink-soft hover:text-ink"
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
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Payment
            </p>
            <button
              type="button"
              aria-label="Open payment picker"
              className="grid size-11 place-items-center rounded-full text-accent transition hover:bg-accent-soft hover:text-accent-strong"
              onClick={() => setPaymentSheetOpen(true)}
            >
              <PlusIcon />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {paymentMethodsLoading ? (
              <span className="text-sm text-muted">Loading...</span>
            ) : paymentMethodsError ? (
              <span className="text-sm text-danger">Failed to load.</span>
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
                      ? "bg-ink text-surface"
                      : "bg-surface-soft text-ink-soft hover:text-ink"
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
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                Tags
              </p>
              <button
                type="button"
                aria-label="Open tag picker"
                className="grid size-11 place-items-center rounded-full text-accent transition hover:bg-accent-soft hover:text-accent-strong"
                onClick={() => setTagSheetOpen(true)}
              >
                <PlusIcon />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tagsLoading ? (
                <span className="text-sm text-muted">Loading...</span>
              ) : tagsError ? (
                <span className="text-sm text-danger">Failed to load.</span>
              ) : (
                <>
                  {selectedTags.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() =>
                        setSelectedTagIds((prev) =>
                          prev.filter((id) => id !== item.id)
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface transition hover:bg-ink-soft"
                    >
                      {item.name}
                      <CloseIcon />
                    </button>
                  ))}
                  {recentTagChoices.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedTagIds((prev) => [...prev, item.id])
                      }
                      className="rounded-full bg-surface-soft px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-ink"
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
            className="text-xs font-semibold text-accent hover:text-accent-strong"
            onClick={() => setTagSheetOpen(true)}
          >
            Add tags
          </button>
        )}
      </div>

      <div className="mt-6">
        {showNotes || notes.trim() ? (
          <>
            <label className="text-xs uppercase tracking-[0.2em] text-muted">
              Notes
            </label>
            <textarea
              className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink transition focus:border-accent sm:text-sm"
              rows={2}
              placeholder="Optional note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </>
        ) : (
          <button
            type="button"
            className="text-xs font-semibold text-accent hover:text-accent-strong"
            onClick={() => setShowNotes(true)}
          >
            Add note
          </button>
        )}
      </div>

      {status ? (
        <p
          role={statusTone === "error" ? "alert" : "status"}
          className={`mt-4 text-sm ${
            statusTone === "error" ? "text-danger" : "text-muted"
          }`}
        >
          {status}
        </p>
      ) : null}

      <div className="sticky bottom-2 z-10 mt-6 rounded-2xl border border-line bg-surface/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_12px_30px_rgba(24,33,28,0.16)] sm:hidden">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSave}
          className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:bg-muted"
        >
          {createTransaction.isPending ? "Saving…" : "Save"}
        </button>
      </div>

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
