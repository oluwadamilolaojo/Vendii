import { newFee } from "./actions";
import type { Claim, FeeState } from "./types";

export type MoneyBucket = "toRequest" | "inFlight" | "failed" | "collected" | "waived";

export const BUCKET_LABEL: Record<MoneyBucket, string> = {
  toRequest: "To debit", inFlight: "Debit in progress", failed: "Failed", collected: "Collected", waived: "Waived",
};

export function feeState(c: Claim): FeeState | null {
  if (c.fee) return c.fee;
  if (c.status === "collected") return newFee(c);
  // Claims paid before fee tracking existed: the fee was collected, there's just no record of attempts.
  if (c.status === "paid") return { ...newFee(c), status: "collected" };
  return null;
}

export function bucketOf(c: Claim): MoneyBucket | null {
  const f = feeState(c);
  if (!f) return null;
  return f.status === "none" ? "toRequest" : f.status === "requested" ? "inFlight" : f.status === "failed" ? "failed" : f.status === "collected" ? "collected" : "waived";
}

export interface MoneySummary {
  recovered: number;          // paid to shareholders by registrars, on closed claims
  feesCollected: number;
  feesOutstanding: number;    // registrar has paid, fee not yet collected
  feesWaived: number;
  failedCount: number;
  retryDueCount: number;
  netToShareholders: number;
}

export function moneySummary(claims: Claim[], now = new Date()): MoneySummary {
  let recovered = 0, feesCollected = 0, feesOutstanding = 0, feesWaived = 0, failedCount = 0, retryDueCount = 0;
  for (const c of claims) {
    const f = feeState(c);
    if (!f) continue;
    if (c.status === "paid" || c.status === "collected") recovered += c.amount;
    if (f.status === "collected") feesCollected += f.amount;
    else if (f.status === "waived") feesWaived += f.amount;
    else feesOutstanding += f.amount;
    if (f.status === "failed") {
      failedCount++;
      if (f.nextRetryAt && new Date(f.nextRetryAt) <= now) retryDueCount++;
    }
  }
  return { recovered, feesCollected, feesOutstanding, feesWaived, failedCount, retryDueCount, netToShareholders: recovered - feesCollected };
}

// ------------------------------------------------------------------ bank statement reconciliation

export interface StatementLine { row: number; date: string; amount: number; narration: string }

/** Minimal CSV reader: quoted fields, commas inside quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const money = (s: string) => Number((s ?? "").replace(/[₦,\s]/g, "").replace(/^\((.*)\)$/, "-$1")) || 0;

/**
 * Reads a bank statement export. Looks for a date column, a credit (or amount) column and a
 * narration/description/reference column by header name, which covers the Nigerian bank exports
 * we've seen. Only money coming in is kept.
 */
export function readStatement(text: string): { lines: StatementLine[]; error: string | null } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { lines: [], error: "That file has no rows." };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const find = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const di = find("date"), ci = find("credit", "deposit", "lodgement", "money in"), ai = find("amount"), ni = find("narration", "description", "remark", "reference", "details");
  if (di < 0 || (ci < 0 && ai < 0) || ni < 0) {
    return { lines: [], error: "We need columns for the date, the credit amount and the narration. Rename the headers or export again." };
  }
  const lines = rows.slice(1).map((r, i) => ({ row: i + 2, date: (r[di] ?? "").trim(), amount: money(r[ci >= 0 ? ci : ai] ?? ""), narration: (r[ni] ?? "").trim() }))
    .filter((l) => l.amount > 0);
  return { lines, error: null };
}

export interface Reconciliation {
  matched: { line: StatementLine; claim: Claim; how: "reference" | "amount" }[];
  /** Ours by reference but the wrong amount: someone should look. */
  amountMismatch: { line: StatementLine; claim: Claim }[];
  /** Marked collected here but no money on the statement. The one that costs real money. */
  missingFromStatement: Claim[];
  /** Credits we can't tie to any fee. Usually not ours. */
  unknownCredits: StatementLine[];
}

export function reconcile(claims: Claim[], lines: StatementLine[]): Reconciliation {
  const fees = claims.map((c) => ({ c, f: feeState(c) })).filter((x): x is { c: Claim; f: FeeState } => !!x.f && ["requested", "collected"].includes(x.f.status));
  const used = new Set<string>();
  const out: Reconciliation = { matched: [], amountMismatch: [], missingFromStatement: [], unknownCredits: [] };
  const rest: StatementLine[] = [];
  for (const l of lines) {
    const n = l.narration.toUpperCase();
    const byRef = fees.find((x) => !used.has(x.c.id) && n.includes(x.f.reference.toUpperCase()));
    if (byRef) {
      used.add(byRef.c.id);
      if (Math.abs(byRef.f.amount - l.amount) < 1) out.matched.push({ line: l, claim: byRef.c, how: "reference" });
      else out.amountMismatch.push({ line: l, claim: byRef.c });
    } else rest.push(l);
  }
  // Second pass: banks sometimes drop the reference. Exact amount, one candidate only.
  for (const l of rest) {
    const cands = fees.filter((x) => !used.has(x.c.id) && Math.abs(x.f.amount - l.amount) < 1);
    if (cands.length === 1) { used.add(cands[0].c.id); out.matched.push({ line: l, claim: cands[0].c, how: "amount" }); }
    else out.unknownCredits.push(l);
  }
  out.missingFromStatement = fees.filter((x) => x.f.status === "collected" && !used.has(x.c.id)).map((x) => x.c);
  return out;
}

export function ledgerCsv(claims: Claim[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Reference", "Claim", "Shareholder", "Company", "Registrar", "Gross recovered", "Fee", "Fee status", "Attempts", "Last error", "Settled at", "Waiver reason"];
  const rows = claims.map((c) => ({ c, f: feeState(c) })).filter((x) => x.f).map(({ c, f }) =>
    [f!.reference, c.id, c.ownerName, c.company, c.registrar, c.amount, f!.amount, f!.status, f!.attempts, f!.lastError, f!.settledAt, f!.waivedReason].map(esc).join(","));
  return [head.map(esc).join(","), ...rows].join("\n");
}
