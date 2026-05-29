"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo, useState } from "react";

import { trpc } from "@/trpc/react";
import type { AppRouter } from "@/server/trpc/root";
import { computeDueDates, nextDueDate } from "@/server/recurring";
import { consumeRecurringPrefill } from "@/lib/entry-prefill";

const formatter = new Intl.NumberFormat("ko-KR");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const sanitizeNumber = (value: string) => value.replace(/[^\d]/g, "");
const formatDigits = (value: string) => {
  if (!value) return "";
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? "" : formatter.format(parsed);
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

type Kind = "SPEND" | "INCOME";
type Cadence = "WEEKLY" | "MONTHLY";
type EndMode = "never" | "date";

type FormState = {
  id: string | null;
  kind: Kind;
  cadence: Cadence;
  dayOfMonth: number;
  dayOfWeek: number;
  startDate: string;
  endMode: EndMode;
  endDate: string;
  autoConfirm: boolean;
  merchant: string;
  gross: string;
  discount: string;
  categoryId: string;
  paymentMethodId: string;
  tagIds: string[];
  description: string;
  revenue: string;
  cost: string;
  cardId: string;
};

const emptyForm = (kind: Kind = "SPEND"): FormState => ({
  id: null,
  kind,
  cadence: "MONTHLY",
  dayOfMonth: new Date().getDate(),
  dayOfWeek: new Date().getDay(),
  startDate: formatLocalDate(new Date()),
  endMode: "never",
  endDate: formatLocalDate(new Date()),
  autoConfirm: false,
  merchant: "",
  gross: "",
  discount: "",
  categoryId: "",
  paymentMethodId: "",
  tagIds: [],
  description: "",
  revenue: "",
  cost: "",
  cardId: "",
});

const endOfThisMonth = () => {
  const now = new Date();
  return formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
};
const endOfThisYear = () => {
  const now = new Date();
  return formatLocalDate(new Date(now.getFullYear(), 11, 31));
};

export function RecurringScreen() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedRuleParam, setAppliedRuleParam] = useState(false);

  const rulesQuery = trpc.recurring.list.useQuery();
  const categoriesQuery = trpc.categories.list.useQuery();
  const paymentMethodsQuery = trpc.paymentMethods.list.useQuery();
  const cardsQuery = trpc.cards.list.useQuery();
  const tagsQuery = trpc.tags.list.useQuery();

  const categories = useMemo(
    () => (Array.isArray(categoriesQuery.data) ? categoriesQuery.data : []),
    [categoriesQuery.data]
  );
  const paymentMethods = useMemo(
    () =>
      Array.isArray(paymentMethodsQuery.data) ? paymentMethodsQuery.data : [],
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

  const refresh = async () => {
    await Promise.all([
      utils.recurring.list.invalidate(),
      utils.recurring.pendingOccurrences.invalidate(),
    ]);
  };

  // Runs generation immediately after a rule changes, so backfilled/ due-today
  // entries appear at once instead of waiting for the next daily sync.
  const syncMutation = trpc.recurring.sync.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.recurring.list.invalidate(),
        utils.recurring.pendingOccurrences.invalidate(),
        utils.transactions.list.invalidate(),
        utils.transactions.summary.invalidate(),
        utils.income.list.invalidate(),
        utils.dashboard.invalidate(),
      ]);
    },
  });

  const afterSave = async () => {
    setForm(null);
    await utils.recurring.list.invalidate();
    syncMutation.mutate();
  };

  const createRule = trpc.recurring.create.useMutation({
    onSuccess: afterSave,
    onError: (e) => setError(e.message || "Unable to save."),
  });
  const updateRule = trpc.recurring.update.useMutation({
    onSuccess: afterSave,
    onError: (e) => setError(e.message || "Unable to save."),
  });
  const setActive = trpc.recurring.setActive.useMutation({
    // Sync on resume so a reactivated rule backfills the paused period now.
    onSuccess: async () => {
      await utils.recurring.list.invalidate();
      syncMutation.mutate();
    },
  });
  const removeRule = trpc.recurring.remove.useMutation({
    onSuccess: refresh,
  });

  // Consume a "Repeat…" handoff from Review (opens the form prefilled).
  useEffect(() => {
    const prefill = consumeRecurringPrefill();
    if (!prefill) return;
    setForm({
      ...emptyForm(prefill.kind),
      dayOfMonth: prefill.dayOfMonth || new Date().getDate(),
      merchant: prefill.merchant ?? "",
      gross: prefill.gross ?? "",
      discount: prefill.discount ?? "",
      categoryId: prefill.categoryId ?? "",
      paymentMethodId: prefill.paymentMethodId ?? "",
      tagIds: prefill.tagIds ?? [],
      description: prefill.description ?? "",
      revenue: prefill.revenue ?? "",
      cost: prefill.cost ?? "",
      cardId: prefill.cardId ?? "",
    });
  }, []);

  const rules = rulesQuery.data ?? [];
  const spendRules = rules.filter((r) => r.kind === "SPEND");
  const incomeRules = rules.filter((r) => r.kind === "INCOME");

  const openCreate = (kind: Kind) => {
    setError(null);
    setForm(emptyForm(kind));
  };

  const openEdit = (rule: (typeof rules)[number]) => {
    setError(null);
    setForm({
      id: rule.id,
      kind: rule.kind,
      cadence: rule.cadence,
      dayOfMonth: rule.dayOfMonth ?? new Date().getDate(),
      dayOfWeek: rule.dayOfWeek ?? new Date().getDay(),
      startDate: formatLocalDate(rule.startDate),
      endMode: rule.endDate ? "date" : "never",
      endDate: rule.endDate ? formatLocalDate(rule.endDate) : endOfThisMonth(),
      autoConfirm: rule.autoConfirm,
      merchant: rule.merchant ?? "",
      gross: rule.grossCents != null ? String(rule.grossCents) : "",
      discount: rule.discountCents ? String(rule.discountCents) : "",
      categoryId: rule.categoryId ?? "",
      paymentMethodId: rule.paymentMethodId ?? "",
      tagIds: rule.tagIds ?? [],
      description: rule.description ?? "",
      revenue: rule.revenueCents != null ? String(rule.revenueCents) : "",
      cost: rule.costCents ? String(rule.costCents) : "",
      cardId: rule.cardId ?? "",
    });
  };

  // Deep link from Review's ↻ badge: /recurring?rule=<id> opens that rule.
  useEffect(() => {
    if (appliedRuleParam || form || typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("rule");
    if (!id) return;
    const match = rules.find((r) => r.id === id);
    if (match) {
      setAppliedRuleParam(true);
      openEdit(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, appliedRuleParam, form]);

  const handleSubmit = () => {
    if (!form) return;
    setError(null);
    const startDate = new Date(`${form.startDate}T00:00:00`);
    if (Number.isNaN(startDate.getTime())) {
      setError("Enter a valid start date.");
      return;
    }
    const endDate =
      form.endMode === "date" ? new Date(`${form.endDate}T00:00:00`) : null;

    const base = {
      kind: form.kind,
      cadence: form.cadence,
      dayOfMonth: form.cadence === "MONTHLY" ? form.dayOfMonth : null,
      dayOfWeek: form.cadence === "WEEKLY" ? form.dayOfWeek : null,
      startDate,
      endDate,
      autoConfirm: form.autoConfirm,
    };

    const payload =
      form.kind === "SPEND"
        ? {
            merchant: form.merchant.trim() || null,
            grossCents: Number.parseInt(form.gross || "0", 10) || 0,
            discountCents: Number.parseInt(form.discount || "0", 10) || 0,
            categoryId: form.categoryId || null,
            paymentMethodId: form.paymentMethodId || null,
            tagIds: form.tagIds,
          }
        : {
            description: form.description.trim(),
            revenueCents: Number.parseInt(form.revenue || "0", 10) || 0,
            costCents: Number.parseInt(form.cost || "0", 10) || 0,
            cardId: form.cardId || null,
          };

    if (form.id) {
      updateRule.mutate({ id: form.id, ...base, ...payload });
    } else {
      createRule.mutate({ ...base, ...payload });
    }
  };

  const toggleTag = (id: string) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            tagIds: prev.tagIds.includes(id)
              ? prev.tagIds.filter((t) => t !== id)
              : [...prev.tagIds, id],
          }
        : prev
    );

  const saving = createRule.isPending || updateRule.isPending;

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900">Recurring</h1>
        {!form ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openCreate("SPEND")}
              className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
            >
              + Spend
            </button>
            <button
              type="button"
              onClick={() => openCreate("INCOME")}
              className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
            >
              + Income
            </button>
          </div>
        ) : null}
      </div>

      {form ? (
        <RuleForm
          form={form}
          setForm={setForm}
          categories={categories}
          paymentMethods={paymentMethods}
          cards={cards}
          tags={tags}
          toggleTag={toggleTag}
          onCancel={() => setForm(null)}
          onSubmit={handleSubmit}
          saving={saving}
          error={error}
          endPresets={{ month: endOfThisMonth, year: endOfThisYear }}
        />
      ) : (
        <div className="mt-6 space-y-6">
          <RuleGroup
            title="Spend"
            rules={spendRules}
            onEdit={openEdit}
            onToggleActive={(id, active) => setActive.mutate({ id, active })}
            onDelete={(id) => {
              if (
                typeof window === "undefined" ||
                window.confirm("Delete this recurring rule?")
              ) {
                removeRule.mutate({ id });
              }
            }}
          />
          <RuleGroup
            title="Income"
            rules={incomeRules}
            onEdit={openEdit}
            onToggleActive={(id, active) => setActive.mutate({ id, active })}
            onDelete={(id) => {
              if (
                typeof window === "undefined" ||
                window.confirm("Delete this recurring rule?")
              ) {
                removeRule.mutate({ id });
              }
            }}
          />
          {rules.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No recurring rules yet. Add one above, or use “Repeat…” on an
              entry in Review.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

type RuleListItem =
  inferRouterOutputs<AppRouter>["recurring"]["list"][number];

function lastOccurrenceOf(rule: RuleListItem): Date | null {
  if (!rule.endDate) return null;
  const occurrences = computeDueDates(
    {
      cadence: rule.cadence,
      dayOfMonth: rule.dayOfMonth,
      dayOfWeek: rule.dayOfWeek,
      startDate: rule.startDate,
      endDate: rule.endDate,
      lastGeneratedDate: null,
    },
    rule.endDate
  );
  return occurrences.length ? occurrences[occurrences.length - 1] : null;
}

function statusOf(rule: RuleListItem) {
  if (!rule.active) return { label: "Paused", tone: "text-zinc-400" };
  if (rule.endDate) {
    const last = lastOccurrenceOf(rule);
    if (!last) return { label: "No occurrences", tone: "text-zinc-400" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (last < today) {
      return { label: `Ended ${formatShortDate(last)}`, tone: "text-zinc-400" };
    }
    return { label: `Ends ${formatShortDate(last)}`, tone: "text-amber-600" };
  }
  return { label: "Active", tone: "text-emerald-600" };
}

function cadenceSummary(rule: RuleListItem) {
  const schedule =
    rule.cadence === "MONTHLY"
      ? `Monthly · day ${rule.dayOfMonth ?? "?"}`
      : `Weekly · ${WEEKDAYS[rule.dayOfWeek ?? 0]}`;
  return `${schedule} · ${rule.autoConfirm ? "auto-add" : "confirm"}`;
}

function amountLabel(rule: RuleListItem) {
  if (rule.kind === "SPEND") {
    const net = (rule.grossCents ?? 0) - (rule.discountCents ?? 0);
    return `₩${formatter.format(net)}`;
  }
  const net = (rule.revenueCents ?? 0) - (rule.costCents ?? 0);
  const sign = net >= 0 ? "+" : "-";
  return `${sign}₩${formatter.format(Math.abs(net))}`;
}

function RuleGroup({
  title,
  rules,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  title: string;
  rules: RuleListItem[];
  onEdit: (rule: RuleListItem) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  if (rules.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
        {title}
      </p>
      <div className="mt-3 space-y-3">
        {rules.map((rule) => {
          const status = statusOf(rule);
          const title =
            rule.kind === "SPEND"
              ? rule.merchant || "Recurring purchase"
              : rule.description || "Recurring income";
          return (
            <div
              key={rule.id}
              className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {title}
                    </p>
                    <span className={`text-xs font-medium ${status.tone}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {cadenceSummary(rule)}
                    {rule.nextDueDate
                      ? ` · next ${formatShortDate(rule.nextDueDate)}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900">
                    {amountLabel(rule)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleActive(rule.id, !rule.active)}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
                  >
                    {rule.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(rule)}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(rule.id)}
                    className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Option = { id: string; name: string };

function RuleForm({
  form,
  setForm,
  categories,
  paymentMethods,
  cards,
  tags,
  toggleTag,
  onCancel,
  onSubmit,
  saving,
  error,
  endPresets,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState | null>>;
  categories: Option[];
  paymentMethods: Option[];
  cards: Option[];
  tags: Option[];
  toggleTag: (id: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  saving: boolean;
  error: string | null;
  endPresets: { month: () => string; year: () => string };
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const lastOccurrence = useMemo(() => {
    if (form.endMode !== "date") return null;
    const start = new Date(`${form.startDate}T00:00:00`);
    const end = new Date(`${form.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    const occurrences = computeDueDates(
      {
        cadence: form.cadence,
        dayOfMonth: form.cadence === "MONTHLY" ? form.dayOfMonth : null,
        dayOfWeek: form.cadence === "WEEKLY" ? form.dayOfWeek : null,
        startDate: start,
        endDate: end,
        lastGeneratedDate: null,
      },
      end
    );
    return occurrences.length ? occurrences[occurrences.length - 1] : null;
  }, [
    form.endMode,
    form.endDate,
    form.startDate,
    form.cadence,
    form.dayOfMonth,
    form.dayOfWeek,
  ]);

  const firstOccurrence = useMemo(() => {
    const start = new Date(`${form.startDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) return null;
    const end =
      form.endMode === "date" ? new Date(`${form.endDate}T00:00:00`) : null;
    return nextDueDate(
      {
        cadence: form.cadence,
        dayOfMonth: form.cadence === "MONTHLY" ? form.dayOfMonth : null,
        dayOfWeek: form.cadence === "WEEKLY" ? form.dayOfWeek : null,
        startDate: start,
        endDate: end && !Number.isNaN(end.getTime()) ? end : null,
      },
      start
    );
  }, [
    form.startDate,
    form.cadence,
    form.dayOfMonth,
    form.dayOfWeek,
    form.endMode,
    form.endDate,
  ]);

  // How many occurrences sync will create immediately on save (start → today).
  const backfillCount = useMemo(() => {
    const start = new Date(`${form.startDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) return 0;
    const end =
      form.endMode === "date" ? new Date(`${form.endDate}T00:00:00`) : null;
    return computeDueDates(
      {
        cadence: form.cadence,
        dayOfMonth: form.cadence === "MONTHLY" ? form.dayOfMonth : null,
        dayOfWeek: form.cadence === "WEEKLY" ? form.dayOfWeek : null,
        startDate: start,
        endDate: end && !Number.isNaN(end.getTime()) ? end : null,
        lastGeneratedDate: null,
      },
      new Date()
    ).length;
  }, [
    form.startDate,
    form.endMode,
    form.endDate,
    form.cadence,
    form.dayOfMonth,
    form.dayOfWeek,
  ]);

  const isSpend = form.kind === "SPEND";
  const labelCls = "text-xs uppercase tracking-[0.2em] text-zinc-400";
  const inputCls =
    "mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900";

  return (
    <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
      <p className="text-sm font-semibold text-zinc-900">
        {form.id ? "Edit rule" : `New ${isSpend ? "spend" : "income"} rule`}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Cadence */}
        <div>
          <label className={labelCls}>Repeat</label>
          <select
            className={`${inputCls} bg-white`}
            value={form.cadence}
            onChange={(e) => set("cadence", e.target.value as Cadence)}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="WEEKLY">Weekly</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>
            {form.cadence === "MONTHLY" ? "Day of month" : "Day of week"}
          </label>
          {form.cadence === "MONTHLY" ? (
            <select
              className={`${inputCls} bg-white`}
              value={form.dayOfMonth}
              onChange={(e) => set("dayOfMonth", Number(e.target.value))}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <select
              className={`${inputCls} bg-white`}
              value={form.dayOfWeek}
              onChange={(e) => set("dayOfWeek", Number(e.target.value))}
            >
              {WEEKDAYS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className={labelCls}>Starts</label>
          <input
            type="date"
            className={inputCls}
            value={form.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
          <p className="mt-2 text-xs text-zinc-500">
            {firstOccurrence
              ? `First occurrence: ${formatShortDate(firstOccurrence)}`
              : "No occurrence on or after this date."}
          </p>
        </div>
        <div>
          <label className={labelCls}>Ends</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { id: "never", label: "Never" },
              { id: "month", label: "End of month" },
              { id: "year", label: "End of year" },
              { id: "date", label: "Pick date" },
            ].map((opt) => {
              const active =
                (opt.id === "never" && form.endMode === "never") ||
                (opt.id === "date" && form.endMode === "date");
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (opt.id === "never") {
                      set("endMode", "never");
                    } else if (opt.id === "month") {
                      set("endMode", "date");
                      set("endDate", endPresets.month());
                    } else if (opt.id === "year") {
                      set("endMode", "date");
                      set("endDate", endPresets.year());
                    } else {
                      set("endMode", "date");
                    }
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {form.endMode === "date" ? (
            <>
              <input
                type="date"
                className={inputCls}
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
              <p className="mt-2 text-xs text-zinc-500">
                {lastOccurrence
                  ? `Last occurrence: ${formatShortDate(lastOccurrence)}`
                  : "No occurrence falls on or before this date."}
              </p>
            </>
          ) : null}
        </div>
      </div>

      {/* Payload */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {isSpend ? (
          <>
            <div className="md:col-span-2">
              <label className={labelCls}>Merchant</label>
              <input
                className={inputCls}
                placeholder="e.g. Rent, Netflix"
                value={form.merchant}
                onChange={(e) => set("merchant", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Amount</label>
              <input
                inputMode="numeric"
                className={inputCls}
                value={formatDigits(form.gross)}
                onChange={(e) => set("gross", sanitizeNumber(e.target.value))}
              />
            </div>
            <div>
              <label className={labelCls}>Discount</label>
              <input
                inputMode="numeric"
                className={inputCls}
                value={formatDigits(form.discount)}
                onChange={(e) =>
                  set("discount", sanitizeNumber(e.target.value))
                }
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select
                className={`${inputCls} bg-white`}
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
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
                className={`${inputCls} bg-white`}
                value={form.paymentMethodId}
                onChange={(e) => set("paymentMethodId", e.target.value)}
              >
                <option value="">None</option>
                {paymentMethods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {tags.length > 0 ? (
              <div className="md:col-span-2">
                <label className={labelCls}>Tags</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        form.tagIds.includes(t.id)
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="md:col-span-2">
              <label className={labelCls}>Description</label>
              <input
                className={inputCls}
                placeholder="e.g. Salary"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Revenue</label>
              <input
                inputMode="numeric"
                className={inputCls}
                value={formatDigits(form.revenue)}
                onChange={(e) => set("revenue", sanitizeNumber(e.target.value))}
              />
            </div>
            <div>
              <label className={labelCls}>Cost</label>
              <input
                inputMode="numeric"
                className={inputCls}
                value={formatDigits(form.cost)}
                onChange={(e) => set("cost", sanitizeNumber(e.target.value))}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Card</label>
              <select
                className={`${inputCls} bg-white`}
                value={form.cardId}
                onChange={(e) => set("cardId", e.target.value)}
              >
                <option value="">None</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <label className="mt-4 flex items-center gap-3 text-sm text-zinc-700">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={form.autoConfirm}
          onChange={(e) => set("autoConfirm", e.target.checked)}
        />
        Add automatically (skip the confirm step) — best for fixed amounts
      </label>

      {backfillCount > 0 ? (
        <p className="mt-3 text-xs text-zinc-500">
          On save:{" "}
          {form.autoConfirm
            ? `adds ${backfillCount} ${
                backfillCount === 1 ? "entry" : "entries"
              } now`
            : `queues ${backfillCount} ${
                backfillCount === 1 ? "entry" : "entries"
              } to confirm`}{" "}
          (dated up to today).
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {saving ? "Saving..." : "Save rule"}
        </button>
      </div>
    </div>
  );
}
