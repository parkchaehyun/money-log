// One-shot handoff used by the Review "Duplicate" action: the data is written
// to sessionStorage, the user is navigated to Quick Add / Income, and the
// target screen reads it once on mount and clears it. Date is intentionally
// omitted so a duplicate always defaults to today.

const SPEND_KEY = "money-log:prefill:spend";
const INCOME_KEY = "money-log:prefill:income";
const RECURRING_KEY = "money-log:prefill:recurring";

export type SpendPrefill = {
  amount: string; // gross, in cents, as a digit string
  discount: string; // in cents; "" when none
  merchant: string;
  notes: string;
  categoryId: string | null;
  paymentMethodId: string | null;
  tagIds: string[];
};

export type IncomePrefill = {
  revenue: string; // in cents, as a digit string
  cost: string; // in cents; "" when none
  description: string;
  cardId: string | null;
};

// Used by Review's "Repeat…" action to open the recurring-rule form prefilled
// from an existing entry.
export type RecurringPrefill = {
  kind: "SPEND" | "INCOME";
  dayOfMonth: number; // from the entry's date, as a sensible monthly default
  merchant?: string;
  gross?: string;
  discount?: string;
  categoryId?: string | null;
  paymentMethodId?: string | null;
  tagIds?: string[];
  description?: string;
  revenue?: string;
  cost?: string;
  cardId?: string | null;
};

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures (private mode, quota).
  }
}

function consume<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    window.sessionStorage.removeItem(key);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const writeSpendPrefill = (value: SpendPrefill) => write(SPEND_KEY, value);
export const consumeSpendPrefill = () => consume<SpendPrefill>(SPEND_KEY);
export const writeIncomePrefill = (value: IncomePrefill) =>
  write(INCOME_KEY, value);
export const consumeIncomePrefill = () => consume<IncomePrefill>(INCOME_KEY);
export const writeRecurringPrefill = (value: RecurringPrefill) =>
  write(RECURRING_KEY, value);
export const consumeRecurringPrefill = () =>
  consume<RecurringPrefill>(RECURRING_KEY);
