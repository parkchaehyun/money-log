import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("recurring confirmation claims the occurrence inside a transaction", async () => {
  const source = await readFile(
    new URL("../src/server/trpc/routers/recurring.ts", import.meta.url),
    "utf8"
  );
  const confirmation = source.slice(
    source.indexOf("confirmOccurrence:"),
    source.indexOf("skipOccurrence:")
  );

  assert.match(confirmation, /ctx\.db\.\$transaction/);
  assert.ok(
    confirmation.indexOf("recurringOccurrence.deleteMany") <
      confirmation.indexOf("materialize("),
    "the pending occurrence must be claimed before its ledger entry is created"
  );
});

test("recurring due actions share a global busy state and wrap on mobile", async () => {
  const source = await readFile(
    new URL("../src/components/recurring-due.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /busy=\{confirm\.isPending \|\| skip\.isPending\}/);
  assert.match(source, /flex w-full flex-wrap items-center/);
  assert.match(source, /disabled=\{busy\}/);
});

test("every income mutation path invalidates the shared income summary", async () => {
  const files = [
    "../src/components/income-screen.tsx",
    "../src/components/review-screen.tsx",
    "../src/components/recurring-due.tsx",
    "../src/components/recurring-screen.tsx",
    "../src/components/recurring-sync.tsx",
  ];

  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /utils\.income\.summary\.invalidate\(\)/, file);
  }
});
