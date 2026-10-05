import { REGISTRARS } from "./registrars";
import { isClosed } from "./claimStatus";
import { DEFAULT_SLA, needsEscalation, slaState } from "./sla";
import type { Claim, RegistrarProfile, RegistrarRequirements, SlaPolicy } from "./types";
import { registrarIdFor } from "@/lib/forms/registry";

export const REQUIREMENT_LABEL: Record<keyof RegistrarRequirements, string> = {
  acceptsPoa: "Accepts filing under our power of attorney",
  acceptsEmail: "Accepts claim packs by email",
  wetInkSignature: "Needs a wet-ink signature",
  bankStamp: "Needs the bank's stamp on the mandate",
  affidavitForNameVariants: "Needs an affidavit for any name variation",
  notarisedPoa: "Needs the power of attorney notarised",
};

const UNKNOWN: RegistrarRequirements = {
  acceptsPoa: null, acceptsEmail: null, wetInkSignature: null, bankStamp: null, affidavitForNameVariants: null, notarisedPoa: null,
};

/** Starting profiles: the 21 registrars whose forms we hold, with contacts as printed. Everything else is unconfirmed. */
export function defaultRegistrarProfiles(): RegistrarProfile[] {
  return REGISTRARS.map((r) => ({
    id: registrarIdFor(r.name) ?? r.name.toLowerCase().replace(/\W+/g, ""),
    name: r.name, contactName: "", email: r.email, phone: "", address: "",
    requirements: { ...UNKNOWN }, notes: "", updatedAt: null, updatedBy: null,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Fills any registrars missing from storage with defaults, so the desk always shows all 21. */
export function withDefaults(saved: RegistrarProfile[]): RegistrarProfile[] {
  const byId = new Map(saved.map((p) => [p.id, p]));
  return defaultRegistrarProfiles().map((d) => {
    const s = byId.get(d.id);
    return s ? { ...d, ...s, requirements: { ...UNKNOWN, ...s.requirements } } : d;
  });
}

export function confirmedRequirements(r: RegistrarRequirements): number {
  return Object.values(r).filter((v) => v !== null).length;
}

export interface RegistrarStats {
  open: number;
  openValue: number;
  overdue: number;
  escalate: number;
  paid: number;
  rejected: number;
  /** Paid out of everything closed. Null until something has closed. */
  acceptanceRate: number | null;
  /** Calendar days from filing to the registrar paying. Null until a claim is paid. */
  medianDaysToPay: number | null;
  oldestOpenDays: number | null;
  rejectionReasons: { reason: string; count: number }[];
}

export const claimRegistrarId = (c: Claim) => registrarIdFor(c.registrar) ?? c.registrar.toLowerCase().replace(/\W+/g, "");

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

function rejectionReason(c: Claim): string {
  const ev = [...c.events].reverse().find((e) => e.title === "Rejected");
  return (ev?.note ?? "No reason recorded").replace(/\s*No fee charged\.?\s*$/, "").trim() || "No reason recorded";
}

export function registrarStats(claims: Claim[], sla: SlaPolicy = DEFAULT_SLA, now = new Date()): RegistrarStats {
  const filed = claims.filter((c) => c.status !== "draft");
  const open = filed.filter((c) => !isClosed(c.status));
  const paid = filed.filter((c) => c.status === "paid");
  const rejected = filed.filter((c) => c.status === "rejected");
  const daysToPay = paid
    .filter((c) => c.submittedAt && c.stateSince)
    .map((c) => (new Date(c.stateSince!).getTime() - new Date(c.submittedAt!).getTime()) / 864e5)
    .filter((d) => d >= 0)
    .map(Math.round);
  const ages = open.filter((c) => c.submittedAt).map((c) => Math.floor((now.getTime() - new Date(c.submittedAt!).getTime()) / 864e5));
  const reasons = new Map<string, number>();
  for (const c of rejected) reasons.set(rejectionReason(c), (reasons.get(rejectionReason(c)) ?? 0) + 1);
  return {
    open: open.length,
    openValue: open.reduce((s, c) => s + c.amount, 0),
    overdue: open.filter((c) => slaState(c, now) === "overdue").length,
    escalate: open.filter((c) => needsEscalation(c, sla, now)).length,
    paid: paid.length,
    rejected: rejected.length,
    acceptanceRate: paid.length + rejected.length ? paid.length / (paid.length + rejected.length) : null,
    medianDaysToPay: median(daysToPay),
    oldestOpenDays: ages.length ? Math.max(...ages) : null,
    rejectionReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}
