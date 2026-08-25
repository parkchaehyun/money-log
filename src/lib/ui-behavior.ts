import { disassemble } from "es-hangul";

export function filterAutocompleteItems<T>(
  items: T[],
  value: string,
  getPrimary: (item: T) => string,
  maxResults = 8
) {
  const query = disassemble(value.trim().toLowerCase());
  if (!query) {
    return [];
  }

  const prefix: T[] = [];
  const substring: T[] = [];
  for (const item of items) {
    const label = disassemble(getPrimary(item).toLowerCase());
    if (label.startsWith(query)) {
      prefix.push(item);
    } else if (label.includes(query)) {
      substring.push(item);
    }
  }
  return [...prefix, ...substring].slice(0, maxResults);
}

export function resolveDashboardPeriod({
  years,
  requestedYear,
  requestedMonth,
  currentYear,
  currentMonth,
}: {
  years: number[];
  requestedYear: number;
  requestedMonth: number;
  currentYear: number;
  currentMonth: number;
}) {
  const year = years.includes(requestedYear)
    ? requestedYear
    : years[0] ?? currentYear;
  const lastMonth = year < currentYear ? 12 : Math.min(currentMonth, 12);
  return {
    year,
    month: Math.min(Math.max(requestedMonth, 1), lastMonth),
  };
}

export function recurringImpactLabel(count: number, autoConfirm: boolean) {
  if (count <= 0) {
    return null;
  }
  if (autoConfirm) {
    return `Creates ${count} past ${count === 1 ? "entry" : "entries"}.`;
  }
  return `Queues ${count} to review.`;
}

export function countAdvancedReviewFilters({
  customRange,
  categoryId,
  paymentMethodId,
  cardId,
  minAmount,
  maxAmount,
  tagCount,
}: {
  customRange: boolean;
  categoryId: string;
  paymentMethodId: string;
  cardId: string;
  minAmount: string;
  maxAmount: string;
  tagCount: number;
}) {
  return (
    Number(customRange) +
    Number(Boolean(categoryId)) +
    Number(Boolean(paymentMethodId)) +
    Number(Boolean(cardId)) +
    Number(Boolean(minAmount)) +
    Number(Boolean(maxAmount)) +
    tagCount
  );
}
