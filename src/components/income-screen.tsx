"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { trpc } from "@/trpc/react";
import { consumeIncomePrefill } from "@/lib/entry-prefill";

import { AutocompleteField } from "./autocomplete-field";
import { SaveToast } from "./save-toast";
import { SelectionSheet } from "./selection-sheet";
import { CloseIcon, PlusIcon } from "./ui-icons";

const formatter = new Intl.NumberFormat("ko-KR");

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

export function IncomeScreen() {
  const utils = trpc.useUtils();
  const [date, setDate] = useState(() => formatLocalDate(new Date()));
  const [revenueInput, setRevenueInput] = useState("");
  const [revenueTouched, setRevenueTouched] = useState(false);
  const [costInput, setCostInput] = useState("");
  const [costEnabled, setCostEnabled] = useState(false);
  const [description, setDescription] = useState("");
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [cardSheetOpen, setCardSheetOpen] = useState(false);
  const revenueRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"info" | "error">("info");
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null
  );

  const { data: cardsData } = trpc.cards.list.useQuery();
  const cards = useMemo(
    () => (Array.isArray(cardsData) ? cardsData : []),
    [cardsData]
  );
  const selectedCard = useMemo(
    () => cards.find((item) => item.id === cardId) ?? null,
    [cardId, cards]
  );

  const sourceOptionsQuery = trpc.income.sourceOptions.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const sourceSuggestions = useMemo(
    () => (Array.isArray(sourceOptionsQuery.data) ? sourceOptionsQuery.data : []),
    [sourceOptionsQuery.data]
  );

  const applySourceSuggestion = (
    suggestion: (typeof sourceSuggestions)[number]
  ) => {
    setDescription(suggestion.description);
    setCardId(suggestion.cardId);
    setRevenueInput(String(suggestion.revenueCents));
    if (suggestion.costCents > 0) {
      setCostEnabled(true);
      setCostInput(String(suggestion.costCents));
    } else {
      setCostEnabled(false);
      setCostInput("");
    }
    // Amount varies most, so focus + select revenue for an immediate retype.
    requestAnimationFrame(() => {
      revenueRef.current?.focus();
      revenueRef.current?.select();
    });
  };

  const revenueValue = Number.parseInt(revenueInput || "0", 10) || 0;
  const costValue =
    costEnabled && costInput
      ? Number.parseInt(costInput || "0", 10) || 0
      : 0;
  const netValue = revenueValue - costValue;
  const revenueError =
    revenueTouched && revenueValue <= 0 && costValue <= 0
      ? "Enter revenue or cost."
      : null;
  const descriptionError =
    descriptionTouched && !description.trim()
      ? "Add a description."
      : null;

  const canSubmit =
    (revenueValue > 0 || costValue > 0) && description.trim().length > 0;

  const createIncome = trpc.income.create.useMutation({
    onSuccess: async () => {
      setStatus(null);
      setToast({ id: Date.now(), message: "Entry saved" });
      setRevenueInput("");
      setRevenueTouched(false);
      setCostInput("");
      setCostEnabled(false);
      setDescription("");
      setDescriptionTouched(false);
      await Promise.all([
        utils.income.list.invalidate(),
        utils.income.summary.invalidate(),
        utils.income.sourceOptions.invalidate(),
        utils.dashboard.invalidate(),
      ]);
    },
    onError: (error) => {
      setStatusTone("error");
      const message =
        error.data?.zodError?.fieldErrors?.revenueCents?.[0] ??
        error.data?.zodError?.fieldErrors?.costCents?.[0] ??
        error.data?.zodError?.fieldErrors?.description?.[0] ??
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

  useEffect(() => {
    const prefill = consumeIncomePrefill();
    if (!prefill) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setRevenueInput(prefill.revenue);
      if (prefill.cost) {
        setCostEnabled(true);
        setCostInput(prefill.cost);
      }
      setDescription(prefill.description);
      setCardId(prefill.cardId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleSave = () => {
    const parsedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      setStatusTone("error");
      setStatus("Please choose a valid date.");
      return;
    }
    if (revenueValue <= 0 && costValue <= 0) {
      setRevenueTouched(true);
      return;
    }
    if (!description.trim()) {
      setDescriptionTouched(true);
      return;
    }
    createIncome.mutate({
      date: parsedDate,
      description: description.trim(),
      revenueCents: revenueValue,
      costCents: costValue,
      cardId,
    });
  };

  const cardItems = cards.map((item) => ({
    id: item.id,
    label: item.name,
  }));

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
          disabled={!canSubmit || createIncome.isPending}
          onClick={handleSave}
          className="hidden rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:bg-muted sm:block"
        >
          {createIncome.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface-soft/35 p-4">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-[0.2em] text-muted">
            Revenue
          </label>
          <button
            type="button"
            className="text-xs font-semibold text-accent hover:text-accent-strong"
            onClick={() => {
              if (costEnabled) {
                setCostEnabled(false);
                setCostInput("");
                return;
              }
              setCostEnabled(true);
              setCostInput("");
            }}
          >
            {costEnabled ? "Remove cost" : "Cost"}
          </button>
        </div>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted">
            ₩
          </span>
          <input
            ref={revenueRef}
            aria-label="Revenue"
            aria-invalid={Boolean(revenueError)}
            inputMode="numeric"
            className="financial-number w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-4 text-lg font-semibold text-ink transition focus:border-accent"
            placeholder="0"
            value={formatDigits(revenueInput)}
            onChange={(event) => setRevenueInput(sanitizeNumber(event.target.value))}
            onBlur={() => setRevenueTouched(true)}
          />
        </div>
        {revenueError ? (
          <p className="mt-2 text-sm text-danger">{revenueError}</p>
        ) : null}
        {costEnabled ? (
          <div className="mt-4">
            <label className="text-xs uppercase tracking-[0.2em] text-muted">
              Cost
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
                ₩
              </span>
              <input
                aria-label="Cost"
                inputMode="numeric"
                className="financial-number w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-4 text-base font-semibold text-ink transition focus:border-accent"
                placeholder="0"
                value={formatDigits(costInput)}
                onChange={(event) => setCostInput(sanitizeNumber(event.target.value))}
              />
            </div>
            {revenueValue > 0 ? (
              <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted">
                <span>Net</span>
                <span className="financial-number text-sm font-semibold text-ink">
                  ₩{formatter.format(netValue)}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <AutocompleteField
          label="Description"
          placeholder="Cashback, interest, rewards"
          value={description}
          onChange={setDescription}
          items={sourceSuggestions}
          onSelect={applySourceSuggestion}
          onBlur={() => setDescriptionTouched(true)}
          getKey={(item) => item.description}
          getPrimary={(item) => item.description}
          getSecondary={(item) => {
            const card = cards.find((c) => c.id === item.cardId);
            return card?.name ?? null;
          }}
          getTrailing={(item) => {
            const net = item.revenueCents - item.costCents;
            const sign = net >= 0 ? "+" : "-";
            return `${sign}₩${formatter.format(Math.abs(net))}`;
          }}
        />
        {descriptionError ? (
          <p className="mt-2 text-sm text-danger">{descriptionError}</p>
        ) : null}
      </div>

      <div className="mt-6">
        {selectedCard ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                Card
              </p>
              <button
                type="button"
                aria-label="Change card"
                className="grid size-11 place-items-center rounded-full text-accent transition hover:bg-accent-soft hover:text-accent-strong"
                onClick={() => setCardSheetOpen(true)}
              >
                <PlusIcon />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                aria-label={`Remove ${selectedCard.name}`}
                onClick={() => setCardId(null)}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface transition hover:bg-ink-soft"
              >
                {selectedCard.name}
                <CloseIcon />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="text-xs font-semibold text-accent hover:text-accent-strong"
            onClick={() => setCardSheetOpen(true)}
          >
            Add card
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
          disabled={!canSubmit || createIncome.isPending}
          onClick={handleSave}
          className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:bg-muted"
        >
          {createIncome.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <SelectionSheet
        open={cardSheetOpen}
        title="Card"
        items={cardItems}
        selectedId={cardId}
        onClose={() => setCardSheetOpen(false)}
        onSelect={setCardId}
        onClear={() => setCardId(null)}
        clearLabel="Clear selection"
      />
    </section>
  );
}
