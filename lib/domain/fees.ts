/** Success fee. Capped at 10% and signed into clause 4 of the authority. */
export const FEE_RATE = 0.1;

/** Fee on sums actually received, in whole naira. Nothing recovered means nothing charged. */
export function feeFor(gross: number, rate: number = FEE_RATE): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  return Math.round(gross * rate);
}

export function netFor(gross: number, rate: number = FEE_RATE): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  return Math.round(gross) - feeFor(gross, rate);
}

export function naira(n: number): string {
  return "\u20A6" + Math.round(n).toLocaleString("en-NG");
}
