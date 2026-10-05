import type { FlowType } from "./types";

export const isElevenDigits = (s: string) => /^\d{11}$/.test((s ?? "").trim());
/** NUBAN account numbers are 10 digits. The check digit needs the bank code, so the provider verifies that. */
export const isNuban = (s: string) => /^\d{10}$/.test((s ?? "").trim());
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s ?? "").trim());

export type FieldErrors = Partial<Record<string, string>>;

export function identityErrors(d: { flowType: FlowType; bvn: string; nin: string; address: string }): FieldErrors {
  const e: FieldErrors = {};
  if (d.bvn && !isElevenDigits(d.bvn)) e.bvn = "A BVN is 11 digits.";
  if (d.nin && !isElevenDigits(d.nin)) e.nin = "A NIN is 11 digits.";
  if (d.flowType === "own") {
    if (!d.bvn && !d.nin) e.bvn = "We need at least one of your BVN or NIN to prove the shares are yours.";
    if (!d.address.trim()) e.address = "Registrars ask for your current address on the mandate form.";
  }
  return e;
}

export function bankErrors(d: { bankName: string; accountNumber: string }): FieldErrors {
  const e: FieldErrors = {};
  if (!d.bankName) e.bankName = "Choose the bank the money should go to.";
  if (!isNuban(d.accountNumber)) e.accountNumber = "Account numbers are 10 digits.";
  return e;
}

export const hasErrors = (e: FieldErrors) => Object.keys(e).length > 0;
