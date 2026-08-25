import assert from "node:assert/strict";
import test from "node:test";

test("autocomplete ranks prefix matches and limits the result set", async () => {
  const helpers = await import("../src/lib/ui-behavior.ts").catch(() => null);

  assert.ok(helpers, "expected shared UI behavior helpers to exist");
  const items = ["Market", "Supermarket", "March", "Cafe"];
  assert.deepEqual(
    helpers.filterAutocompleteItems(items, "mar", (item) => item, 2),
    ["Market", "March"]
  );
});

test("dashboard period falls back to an available year and valid month", async () => {
  const helpers = await import("../src/lib/ui-behavior.ts").catch(() => null);

  assert.ok(helpers, "expected shared UI behavior helpers to exist");
  assert.deepEqual(
    helpers.resolveDashboardPeriod({
      years: [2025, 2024],
      requestedYear: 2026,
      requestedMonth: 12,
      currentYear: 2026,
      currentMonth: 8,
    }),
    { year: 2025, month: 12 }
  );
  assert.deepEqual(
    helpers.resolveDashboardPeriod({
      years: [2026, 2025],
      requestedYear: 2026,
      requestedMonth: 12,
      currentYear: 2026,
      currentMonth: 8,
    }),
    { year: 2026, month: 8 }
  );
});

test("header totals identify outflow when spend exceeds income", async () => {
  const totals = await import("../src/lib/header-totals.ts").catch(() => null);

  assert.ok(totals, "expected header totals helper to exist");
  assert.deepEqual(totals.getHeaderTotals(10_000, 2_000), {
    spendCents: 10_000,
    incomeCents: 2_000,
    balanceLabel: "Outflow",
    balanceCents: 8_000,
  });
});

test("header totals identify surplus when income exceeds spend", async () => {
  const totals = await import("../src/lib/header-totals.ts").catch(() => null);

  assert.ok(totals, "expected header totals helper to exist");
  assert.deepEqual(totals.getHeaderTotals(2_000, 10_000), {
    spendCents: 2_000,
    incomeCents: 10_000,
    balanceLabel: "Surplus",
    balanceCents: 8_000,
  });
});

test("recurring impact copy stays concise and distinguishes automatic entries", async () => {
  const helpers = await import("../src/lib/ui-behavior.ts").catch(() => null);

  assert.ok(helpers, "expected shared UI behavior helpers to exist");
  assert.equal(helpers.recurringImpactLabel(0, false), null);
  assert.equal(helpers.recurringImpactLabel(1, true), "Creates 1 past entry.");
  assert.equal(helpers.recurringImpactLabel(3, false), "Queues 3 to review.");
});

test("review active filter count ignores the default month and search", async () => {
  const helpers = await import("../src/lib/ui-behavior.ts").catch(() => null);

  assert.ok(helpers, "expected shared UI behavior helpers to exist");
  assert.equal(
    helpers.countAdvancedReviewFilters({
      customRange: false,
      categoryId: "food",
      paymentMethodId: "",
      cardId: "",
      minAmount: "1000",
      maxAmount: "",
      tagCount: 2,
    }),
    4
  );
});

test("resuming today skips paused dates but keeps today eligible", async () => {
  const recurring = await import("../src/server/recurring.ts");
  const today = new Date(2026, 7, 25, 15, 30);

  assert.deepEqual(
    recurring.resumeCursor(today),
    new Date(2026, 7, 24, 0, 0, 0, 0)
  );
});

test("resuming never rewinds a day that was already generated", async () => {
  const recurring = await import("../src/server/recurring.ts");
  const today = new Date(2026, 7, 25, 15, 30);

  assert.deepEqual(
    recurring.resumeLastGeneratedDate(new Date(2026, 7, 25), today),
    new Date(2026, 7, 25)
  );
  assert.deepEqual(
    recurring.resumeLastGeneratedDate(null, today),
    new Date(2026, 7, 24)
  );
});
