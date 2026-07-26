"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";

import { DiscountInput } from "@/components/discount-input";
import { trpc } from "@/trpc/react";
import type { AppRouter } from "@/server/trpc/root";

const formatter = new Intl.NumberFormat("ko-KR");
const sanitizeNumber = (value: string) => value.replace(/[^\d]/g, "");
const formatDigits = (value: string) => {
  if (!value) return "";
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? "" : formatter.format(parsed);
};
const centsToInput = (value: number | null | undefined) =>
  value && value > 0 ? String(value) : "";
const parseOptionalCents = (value: string) => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};
const formatLocalDate = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const formatShortDate = (value: Date) => {
  const y = String(value.getFullYear()).slice(-2);
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
};

type Occurrence =
  inferRouterOutputs<AppRouter>["recurring"]["pendingOccurrences"][number];
type Option = { id: string; name: string };
type ConfirmInput = Parameters<
  ReturnType<typeof trpc.recurring.confirmOccurrence.useMutation>["mutate"]
>[0];

export function RecurringDue() {
  const utils = trpc.useUtils();
  const pendingQuery = trpc.recurring.pendingOccurrences.useQuery();
  const categoriesQuery = trpc.categories.list.useQuery();
  const paymentMethodsQuery = trpc.paymentMethods.list.useQuery();
  const cardsQuery = trpc.cards.list.useQuery();

  const categories = Array.isArray(categoriesQuery.data)
    ? categoriesQuery.data
    : [];
  const paymentMethods = Array.isArray(paymentMethodsQuery.data)
    ? paymentMethodsQuery.data
    : [];
  const cards = Array.isArray(cardsQuery.data) ? cardsQuery.data : [];

  const invalidateAfterChange = async (created: boolean) => {
    await utils.recurring.pendingOccurrences.invalidate();
    if (created) {
      await Promise.all([
        utils.transactions.list.invalidate(),
        utils.transactions.summary.invalidate(),
        utils.income.list.invalidate(),
        utils.dashboard.invalidate(),
      ]);
    }
  };

  const confirm = trpc.recurring.confirmOccurrence.useMutation({
    onSuccess: () => invalidateAfterChange(true),
  });
  const skip = trpc.recurring.skipOccurrence.useMutation({
    onSuccess: () => invalidateAfterChange(false),
  });

  const items = pendingQuery.data ?? [];
  if (items.length === 0) {
    return null;
  }

  const busy = confirm.isPending || skip.isPending;

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">
          Due now
          <span className="ml-2 text-zinc-400">{items.length}</span>
        </h2>
        <span className="text-xs uppercase tracking-[0.2em] text-amber-600">
          Recurring
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((occ) => (
          <DueCard
            key={occ.id}
            occ={occ}
            categories={categories}
            paymentMethods={paymentMethods}
            cards={cards}
            busy={busy}
            onConfirm={(overrides) => confirm.mutate({ id: occ.id, ...overrides })}
            onSkip={() => skip.mutate({ id: occ.id })}
          />
        ))}
      </div>
    </section>
  );
}

function DueCard({
  occ,
  categories,
  paymentMethods,
  cards,
  busy,
  onConfirm,
  onSkip,
}: {
  occ: Occurrence;
  categories: Option[];
  paymentMethods: Option[];
  cards: Option[];
  busy: boolean;
  onConfirm: (overrides: Omit<ConfirmInput, "id">) => void;
  onSkip: () => void;
}) {
  const rule = occ.rule;
  const isSpend = rule.kind === "SPEND";

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => formatLocalDate(occ.dueDate));
  const [merchant, setMerchant] = useState(rule.merchant ?? "");
  const [amount, setAmount] = useState(
    centsToInput(isSpend ? rule.grossCents : rule.revenueCents)
  );
  const [second, setSecond] = useState(
    centsToInput(isSpend ? rule.discountCents : rule.costCents)
  );
  const [discountCalculationError, setDiscountCalculationError] = useState<
    string | null
  >(null);
  const [description, setDescription] = useState(rule.description ?? "");
  const [categoryId, setCategoryId] = useState(rule.categoryId ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(
    rule.paymentMethodId ?? ""
  );
  const [cardId, setCardId] = useState(rule.cardId ?? "");

  const title = isSpend
    ? rule.merchant || "Recurring purchase"
    : rule.description || "Recurring income";
  const meta = isSpend
    ? [rule.category?.name, rule.paymentMethod?.name].filter(Boolean).join(" · ")
    : rule.card?.name ?? "";

  const handleAdd = () => {
    setError(null);
    const amountCents = parseOptionalCents(amount);
    const secondCents = parseOptionalCents(second);
    if (editing && isSpend && discountCalculationError) {
      return;
    }
    if (!editing) {
      if (isSpend) {
        if (!amountCents || amountCents <= 0) {
          setError("Enter an amount before adding.");
          return;
        }
        onConfirm({ grossCents: amountCents });
        return;
      }
      if ((amountCents ?? 0) <= 0 && (secondCents ?? 0) <= 0) {
        setError("Enter revenue or cost before adding.");
        return;
      }
      onConfirm({ revenueCents: amountCents, costCents: secondCents });
      return;
    }
    const parsedDate = new Date(`${date}T12:00:00`);
    const dateOverride = Number.isNaN(parsedDate.getTime())
      ? undefined
      : parsedDate;
    if (isSpend) {
      if (!amountCents || amountCents <= 0) {
        setError("Enter an amount before adding.");
        return;
      }
      if ((secondCents ?? 0) > amountCents) {
        setError("Discount cannot exceed the amount.");
        return;
      }
      onConfirm({
        date: dateOverride,
        merchant: merchant.trim() || null,
        grossCents: amountCents,
        discountCents: secondCents,
        categoryId: categoryId || null,
        paymentMethodId: paymentMethodId || null,
      });
    } else {
      if ((amountCents ?? 0) <= 0 && (secondCents ?? 0) <= 0) {
        setError("Enter revenue or cost before adding.");
        return;
      }
      onConfirm({
        date: dateOverride,
        description: description.trim() || undefined,
        revenueCents: amountCents,
        costCents: secondCents,
        cardId: cardId || null,
      });
    }
  };

  const labelCls = "text-xs uppercase tracking-[0.2em] text-zinc-400";
  const fieldCls =
    "mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900";

  return (
    <div className="rounded-2xl border border-amber-100 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">{title}</p>
          <p className="text-xs text-zinc-500">
            {formatShortDate(occ.dueDate)}
            {meta ? ` · ${meta}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400">
                ₩
              </span>
              <input
                inputMode="numeric"
                aria-label="Amount"
                placeholder="Amount"
                className="w-32 rounded-xl border border-zinc-200 py-2 pl-7 pr-3 text-right text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-900"
                value={formatDigits(amount)}
                onChange={(e) => {
                  setError(null);
                  setAmount(sanitizeNumber(e.target.value));
                }}
              />
            </div>
          ) : null}
          <button
            type="button"
            disabled={
              busy || (editing && isSpend && Boolean(discountCalculationError))
            }
            onClick={handleAdd}
            className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              if (editing) {
                setError(null);
                setDiscountCalculationError(null);
              }
              setEditing((value) => !value);
            }}
            className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSkip}
            className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-900 disabled:cursor-not-allowed"
          >
            Skip
          </button>
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      {editing ? (
        <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelCls}>{isSpend ? "Merchant" : "Description"}</label>
            <input
              className={fieldCls}
              value={isSpend ? merchant : description}
              onChange={(e) =>
                isSpend
                  ? setMerchant(e.target.value)
                  : setDescription(e.target.value)
              }
            />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input
              type="date"
              className={fieldCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>{isSpend ? "Amount" : "Revenue"}</label>
            <input
              inputMode="numeric"
              className={fieldCls}
              value={formatDigits(amount)}
              onChange={(e) => {
                setError(null);
                setAmount(sanitizeNumber(e.target.value));
              }}
            />
          </div>
          {isSpend ? (
            <DiscountInput
              className="md:col-span-2"
              compact
              grossValue={amount}
              discountValue={second}
              onValueChange={(value, meta) => {
                setSecond(value);
                setDiscountCalculationError(meta.error);
              }}
            />
          ) : (
            <div>
              <label className={labelCls}>Cost</label>
              <input
                inputMode="numeric"
                className={fieldCls}
                value={formatDigits(second)}
                onChange={(e) => {
                  setError(null);
                  setSecond(sanitizeNumber(e.target.value));
                }}
              />
            </div>
          )}
          {isSpend ? (
            <>
              <div>
                <label className={labelCls}>Category</label>
                <select
                  className={`${fieldCls} bg-white`}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Payment</label>
                <select
                  className={`${fieldCls} bg-white`}
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                >
                  <option value="">None</option>
                  {paymentMethods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="md:col-span-2">
              <label className={labelCls}>Card</label>
              <select
                className={`${fieldCls} bg-white`}
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
              >
                <option value="">None</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
