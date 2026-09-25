import { DEFAULT_FX_RATES, type Currency } from "@/lib/constants";

export interface FxQuote {
  base: Currency;
  quote: Currency;
  rate: number;
  effective_at: string;
  source: string;
}

const inMemoryCache = new Map<string, FxQuote>();

function key(base: Currency, quote: Currency) {
  return `${base}_${quote}`;
}

export function setRate(quote: FxQuote) {
  inMemoryCache.set(key(quote.base, quote.quote), quote);
}

export function getRate(base: Currency, quote: Currency): number {
  if (base === quote) return 1;
  const cached = inMemoryCache.get(key(base, quote));
  if (cached) return cached.rate;
  const baseToUsd = base === "USD" ? 1 : 1 / DEFAULT_FX_RATES[base];
  const usdToQuote = quote === "USD" ? 1 : DEFAULT_FX_RATES[quote];
  return baseToUsd * usdToQuote;
}

export function convert(
  amount: number,
  from: Currency,
  to: Currency,
): number {
  if (from === to) return amount;
  return amount * getRate(from, to);
}

export function toUSD(amount: number, currency: Currency): number {
  return convert(amount, currency, "USD");
}

export function fromUSD(amount: number, currency: Currency): number {
  return convert(amount, "USD", currency);
}

export async function fetchLatestRates(): Promise<Record<Currency, number>> {
  return { ...DEFAULT_FX_RATES };
}
