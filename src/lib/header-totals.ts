export function getHeaderTotals(spendCents: number, incomeCents: number) {
  const balance = spendCents - incomeCents;

  return {
    spendCents,
    incomeCents,
    balanceLabel: balance >= 0 ? ("Outflow" as const) : ("Surplus" as const),
    balanceCents: Math.abs(balance),
  };
}
