"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

import { trpc } from "@/trpc/react";

import { SelectionSheet } from "./selection-sheet";

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
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"info" | "error">("info");
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null
  );
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const { data: cardsData } = trpc.cards.list.useQuery();
  const cards = useMemo(
    () => (Array.isArray(cardsData) ? cardsData : []),
    [cardsData]
  );
  const selectedCard = useMemo(
    () => cards.find((item) => item.id === cardId) ?? null,
    [cardId, cards]
  );

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
      await utils.income.list.invalidate();
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
                  className="rounded-full bg-white/20"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    flex: "0 0 20px",
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
                <span>{toast.message}</span>
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
          disabled={!canSubmit || createIncome.isPending}
          onClick={handleSave}
          className="rounded-2xl bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {createIncome.isPending ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            Revenue
          </label>
          <button
            type="button"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
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
            {costEnabled ? "Remove cost" : "+ Cost"}
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
            value={formatDigits(revenueInput)}
            onChange={(event) => setRevenueInput(sanitizeNumber(event.target.value))}
            onBlur={() => setRevenueTouched(true)}
          />
        </div>
        {revenueError ? (
          <p className="mt-2 text-sm text-red-600">{revenueError}</p>
        ) : null}
        {costEnabled ? (
          <div className="mt-4">
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Cost
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400">
                ₩
              </span>
              <input
                inputMode="numeric"
                className="w-full rounded-2xl border border-zinc-200 bg-white py-2 pl-9 pr-4 text-base font-semibold text-zinc-900 outline-none transition focus:border-zinc-900"
                placeholder="0"
                value={formatDigits(costInput)}
                onChange={(event) => setCostInput(sanitizeNumber(event.target.value))}
              />
            </div>
            {revenueValue > 0 ? (
              <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-400">
                <span>Net</span>
                <span className="text-sm font-semibold text-zinc-900">
                  ₩{formatter.format(netValue)}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
          Description
        </label>
        <input
          className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base outline-none transition focus:border-zinc-900 sm:text-sm"
          placeholder="Cashback, interest, rewards"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => setDescriptionTouched(true)}
        />
        {descriptionError ? (
          <p className="mt-2 text-sm text-red-600">{descriptionError}</p>
        ) : null}
      </div>

      <div className="mt-6">
        {selectedCard ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Card
              </p>
              <button
                type="button"
                aria-label="Change card"
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                onClick={() => setCardSheetOpen(true)}
              >
                +
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCardId(null)}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                {selectedCard.name} ×
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            onClick={() => setCardSheetOpen(true)}
          >
            + Add card
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
