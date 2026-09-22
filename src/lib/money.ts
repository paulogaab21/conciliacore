export function formatMoney(amountCents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export function parseMoneyToCents(value: string | number): number {
  if (typeof value === "number") {
    return Math.round(value * 100);
  }

  const normalized = value
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return Math.round(parsed * 100);
}
