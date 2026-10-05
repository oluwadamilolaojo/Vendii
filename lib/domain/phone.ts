/**
 * Normalize a Nigerian mobile number to E.164 (+234...). Accepts 0803..., 803..., 234803..., +234 803 ...
 * Returns null for anything that isn't a Nigerian mobile (070, 080, 081, 090, 091 ranges).
 */
export function normalizeNgPhone(input: string): string | null {
  let d = (input ?? "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("234")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  if (!/^[789][01]\d{8}$/.test(d)) return null;
  return "+234" + d;
}

export function formatNgPhone(e164: string): string {
  const d = e164.replace(/^\+234/, "0");
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : e164;
}
