// Pure scheduling logic for recurring rules — no DB access, so it's easy to
// reason about and reuse. Dates are handled at local-midnight granularity to
// match how the rest of the app stores/compares dates.

export type RecurringSchedule = {
  cadence: "WEEKLY" | "MONTHLY";
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  startDate: Date;
  endDate: Date | null;
  lastGeneratedDate: Date | null;
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const daysInMonth = (year: number, monthIndex: number) =>
  new Date(year, monthIndex + 1, 0).getDate();

// Hard cap to guarantee loop termination even with malformed data.
const MAX_ITER = 1200;

/**
 * All occurrence dates that should be generated now: strictly after
 * lastGeneratedDate (or from startDate), up to and including today, bounded by
 * endDate. Returns date-only values at local midnight.
 */
export function computeDueDates(rule: RecurringSchedule, today: Date): Date[] {
  const start = startOfDay(rule.startDate);
  const end = rule.endDate ? startOfDay(rule.endDate) : null;
  const through = startOfDay(today);
  const upper = end && end < through ? end : through;

  let lower = rule.lastGeneratedDate
    ? addDays(startOfDay(rule.lastGeneratedDate), 1)
    : start;
  if (lower < start) {
    lower = start;
  }
  if (upper < lower) {
    return [];
  }

  const result: Date[] = [];
  if (rule.cadence === "MONTHLY") {
    const day = rule.dayOfMonth ?? 1;
    let year = lower.getFullYear();
    let month = lower.getMonth();
    for (let i = 0; i < MAX_ITER; i += 1) {
      const occ = new Date(year, month, Math.min(day, daysInMonth(year, month)));
      if (occ > upper) {
        break;
      }
      if (occ >= lower) {
        result.push(occ);
      }
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
  } else {
    const target = rule.dayOfWeek ?? 0;
    let cursor = new Date(lower);
    cursor = addDays(cursor, (target - cursor.getDay() + 7) % 7);
    while (cursor <= upper) {
      result.push(cursor);
      cursor = addDays(cursor, 7);
    }
  }
  return result;
}

/**
 * The next occurrence on or after today (for display), ignoring generation
 * history and respecting endDate. Null when the rule has already ended.
 */
export function nextDueDate(
  rule: Omit<RecurringSchedule, "lastGeneratedDate">,
  today: Date
): Date | null {
  const start = startOfDay(rule.startDate);
  const end = rule.endDate ? startOfDay(rule.endDate) : null;
  const todayStart = startOfDay(today);
  const from = todayStart > start ? todayStart : start;
  if (end && from > end) {
    return null;
  }

  let occ: Date | null = null;
  if (rule.cadence === "MONTHLY") {
    const day = rule.dayOfMonth ?? 1;
    let year = from.getFullYear();
    let month = from.getMonth();
    for (let i = 0; i < MAX_ITER; i += 1) {
      const candidate = new Date(
        year,
        month,
        Math.min(day, daysInMonth(year, month))
      );
      if (candidate >= from) {
        occ = candidate;
        break;
      }
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
  } else {
    const target = rule.dayOfWeek ?? 0;
    occ = addDays(from, (target - from.getDay() + 7) % 7);
  }

  if (occ && end && occ > end) {
    return null;
  }
  return occ;
}
