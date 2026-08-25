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
        utils.transactions.merchantOptions.invalidate(),
        utils.income.list.invalidate(),
        utils.income.summary.invalidate(),
        utils.income.sourceOptions.invalidate(),
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

  if (pendingQuery.isError) {
    return (
      <section className="rounded-2xl bg-danger/5 p-4" role="alert">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-danger">Couldn’t load recurring entries.</p>
          <button type="button" onClick={() => void pendingQuery.refetch()} className="rounded-lg px-3 text-sm font-semibold text-danger hover:bg-white">Retry</button>
        </div>
      </section>
    );
  }

  const items = pendingQuery.data ?? [];
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-warning/25 bg-warning/5 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Due now
          <span className="ml-2 text-muted">{items.length}</span>
        </h2>
        <span className="text-xs uppercase tracking-[0.2em] text-warning">
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
            busy={confirm.isPending || skip.isPending}
            confirming={confirm.isPending && confirm.variables?.id === occ.id}
            skipping={skip.isPending && skip.variables?.id === occ.id}
            mutationError={
              confirm.variables?.id === occ.id
                ? confirm.error?.message
                : skip.variables?.id === occ.id
                  ? skip.error?.message
                  : undefined
            }
            onConfirm={(overrides) => confirm.mutate({ id: occ.id, ...overrides })}
            onSkip={() => {
              if (window.confirm("Skip this occurrence?")) {
                skip.mutate({ id: occ.id });
              }
            }}
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
  confirming,
  skipping,
  mutationError,
  onConfirm,
  onSkip,
}: {
  occ: Occurrence;
  categories: Option[];
  paymentMethods: Option[];
  cards: Option[];
  busy: boolean;
  confirming: boolean;
  skipping: boolean;
  mutationError?: string;
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

  const labelCls = "text-sm font-medium text-ink-soft";
  const fieldCls =
    "mt-1 w-full rounded-xl border border-line px-3 py-2 text-base text-ink transition focus:border-accent";

  return (
    <div className="rounded-xl border border-warning/20 bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          <p className="text-xs text-muted">
            {formatShortDate(occ.dueDate)}
            {meta ? ` · ${meta}` : ""}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {!editing ? (
            <div className="relative min-w-32 flex-1 sm:flex-none">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
                ₩
              </span>
              <input
                disabled={busy}
                inputMode="numeric"
                aria-label="Amount"
                placeholder="Amount"
                className="w-full rounded-xl border border-line py-2 pl-7 pr-3 text-right text-sm font-semibold text-ink transition focus:border-accent sm:w-32"
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
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:bg-muted"
          >
            {confirming ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (editing) {
                setError(null);
                setDiscountCalculationError(null);
              }
              setEditing((value) => !value);
            }}
            className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSkip}
            className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-muted transition hover:text-ink disabled:cursor-not-allowed"
          >
            {skipping ? "Skipping…" : "Skip"}
          </button>
        </div>
      </div>

      {error || mutationError ? <p role="alert" className="mt-2 text-sm text-danger">{error ?? "Couldn’t update entry."}</p> : null}

      {editing ? (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelCls}>{isSpend ? "Merchant" : "Description"}</label>
            <input
              aria-label={isSpend ? "Merchant" : "Description"}
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
              aria-label="Date"
              className={fieldCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>{isSpend ? "Amount" : "Revenue"}</label>
            <input
              inputMode="numeric"
              aria-label={isSpend ? "Amount" : "Revenue"}
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
                aria-label="Cost"
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
                  aria-label="Category"
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
                  aria-label="Payment method"
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
              aria-label="Card"
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
