import assert from "node:assert/strict";
import test from "node:test";

test("review payment method values round-trip through the edit draft", async () => {
  const reviewEdit = await import("../src/lib/review-spend-edit.ts").catch(
    () => null
  );

  assert.ok(reviewEdit, "expected review spend edit helpers to exist");
  assert.equal(reviewEdit.toPaymentMethodDraft("method-1"), "method-1");
  assert.equal(reviewEdit.toPaymentMethodDraft(null), "");
  assert.equal(reviewEdit.toPaymentMethodUpdate("method-1"), "method-1");
  assert.equal(reviewEdit.toPaymentMethodUpdate(""), null);
});
