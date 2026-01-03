"use client";

import { useMemo, useState } from "react";

import { trpc } from "@/trpc/react";

import { SelectionSheet } from "./selection-sheet";

const formatter = new Intl.NumberFormat("ko-KR");

const formatLocalDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sanitizeNumber = (value: string) => value.replace(/[^\d]/g, "");

export function QuickAddScreen() {
  const utils = trpc.useUtils();
  const [date, setDate] = useState(() => formatLocalDate(new Date()));
  const [grossInput, setGrossInput] = useState("");
  const [discountInput, setDiscountInput] = useState("0");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"info" | "error">("info");

  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

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

  const grossValue = Number.parseInt(grossInput || "0", 10) || 0;
  const discountValue = Number.parseInt(discountInput || "0", 10) || 0;
  const paidValue = Math.max(0, grossValue - discountValue);
  const discountError =
    grossValue > 0 && discountValue > grossValue
      ? "Discount cannot exceed price."
      : null;

  const createTransaction = trpc.transactions.create.useMutation({
    onSuccess: async () => {
      setStatusTone("info");
      setStatus("Entry saved.");
      setGrossInput("");
      setDiscountInput("0");
      setMerchant("");
      await utils.transactions.list.invalidate();
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

  const createCategory = trpc.categories.create.useMutation({
    onSuccess: async (data) => {
      await utils.categories.list.invalidate();
      setCategoryId(data.id);
    },
  });

  const createPaymentMethod = trpc.paymentMethods.create.useMutation({
    onSuccess: async (data) => {
      await utils.paymentMethods.list.invalidate();
      setPaymentMethodId(data.id);
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

  const topCategories = useMemo(() => categories.slice(0, 6), [categories]);
  const topPaymentMethods = useMemo(
    () => paymentMethods.slice(0, 4),
    [paymentMethods]
  );

  const categoryItems = categories.map((item) => ({
    id: item.id,
    label: item.name,
  }));

  const paymentItems = paymentMethods.map((item) => ({
    id: item.id,
    label: item.name,
    subLabel: item.card?.name ?? null,
  }));

  const canSubmit =
    grossValue > 0 &&
    discountValue >= 0 &&
    !discountError &&
    !createTransaction.isPending;

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Quick Add
          </p>
          <h2 className="text-2xl font-semibold text-zinc-900">
            Log a purchase
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          <span>Date</span>
          <input
            type="date"
            className="bg-transparent text-sm text-zinc-900 outline-none"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            Price
          </label>
          <input
            inputMode="numeric"
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-lg font-semibold text-zinc-900 outline-none transition focus:border-zinc-900"
            placeholder="0"
            value={grossInput}
            onChange={(event) =>
              setGrossInput(sanitizeNumber(event.target.value))
            }
          />
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            Discount
          </label>
          <input
            inputMode="numeric"
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-lg font-semibold text-zinc-900 outline-none transition focus:border-zinc-900"
            value={discountInput}
            onChange={(event) =>
              setDiscountInput(sanitizeNumber(event.target.value))
            }
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
        <span className="text-zinc-500">Paid</span>
        <span className="text-lg font-semibold text-zinc-900">
          ₩{formatter.format(paidValue)}
        </span>
      </div>

      {discountError ? (
        <p className="mt-2 text-sm text-red-600">{discountError}</p>
      ) : null}

      <div className="mt-6">
        <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
          Merchant
        </label>
        <input
          className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
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
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              onClick={() => setCategorySheetOpen(true)}
            >
              More
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categoriesLoading ? (
              <span className="text-sm text-zinc-400">Loading...</span>
            ) : categoriesError ? (
              <span className="text-sm text-red-500">Failed to load.</span>
            ) : (
              topCategories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategoryId(item.id)}
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
            <button
              type="button"
              onClick={() => setCategorySheetOpen(true)}
              className="rounded-full border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900"
            >
              + Add
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Payment
            </p>
            <button
              type="button"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              onClick={() => setPaymentSheetOpen(true)}
            >
              More
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {paymentMethodsLoading ? (
              <span className="text-sm text-zinc-400">Loading...</span>
            ) : paymentMethodsError ? (
              <span className="text-sm text-red-500">Failed to load.</span>
            ) : (
              topPaymentMethods.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPaymentMethodId(item.id)}
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
            <button
              type="button"
              onClick={() => setPaymentSheetOpen(true)}
              className="rounded-full border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900"
            >
              + Add
            </button>
          </div>
        </div>
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

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
          Paid amount auto-calculated
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            const parsedDate = new Date(`${date}T00:00:00`);
            if (Number.isNaN(parsedDate.getTime())) {
              setStatusTone("error");
              setStatus("Please choose a valid date.");
              return;
            }
            createTransaction.mutate({
              date: parsedDate,
              merchant: merchant.trim() || null,
              grossCents: grossValue,
              discountCents: discountValue,
              categoryId,
              paymentMethodId,
            });
          }}
          className="rounded-2xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {createTransaction.isPending ? "Saving..." : "Save entry"}
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

      <SelectionSheet
        open={paymentSheetOpen}
        title="Payment Method"
        items={paymentItems}
        selectedId={paymentMethodId}
        onClose={() => setPaymentSheetOpen(false)}
        onSelect={setPaymentMethodId}
        onCreate={async (name) => {
          await createPaymentMethod.mutateAsync({ name });
        }}
        createLabel="Add new payment method"
      />
    </section>
  );
}
