export const toPaymentMethodDraft = (paymentMethodId?: string | null) =>
  paymentMethodId ?? "";

export const toPaymentMethodUpdate = (paymentMethodId: string) =>
  paymentMethodId || null;
