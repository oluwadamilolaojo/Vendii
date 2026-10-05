/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ClaimAction } from "@/lib/domain/actions";
import type { Claim, ContactDetails, FlowType, PersonName } from "@/lib/domain/types";

/**
 * Firestore layout. Shared by the browser repository and the server routes.
 *
 *   registerEntries/{id}   server only. Ingested register data.
 *   filings/{id}           one per filing. Owner and ops can read. Server writes.
 *   claims/{id}            owner and ops can read. Server writes.
 *   feeDebits/{claimId}    fee ledger, one per claim, mirrors claim.fee plus every attempt.
 *   auditLog/{id}          who did what. Written in the same transaction as the change.
 *   registrars/{id}        contacts and the acceptance matrix, keyed by form template id.
 *   staff/{uid}            the team directory. Roles themselves live in Auth custom claims.
 *   config/settings        SLA policy.
 *   outboundMessages/{id}  chase emails waiting for a sender. Ops can read.
 *
 * Storage: identity-photos/{uid}/, signatures/{uid}/, estate-documents/{uid}/
 */
export const COL = {
  register: "registerEntries",
  filings: "filings",
  claims: "claims",
  feeDebits: "feeDebits",
  outbound: "outboundMessages",
  audit: "auditLog",
  registrars: "registrars",
  staff: "staff",
  config: "config",
} as const;

export const SETTINGS_DOC = "settings";

export interface RegisterEntryDoc {
  company: string;
  ticker: string;
  registrar: string;
  holderName: string;
  holderNameNorm: string;
  units: number;
  years: string;
  estimatedAmount: number;
  /** YYYY-MM-DD. Decides whether the dividend is still inside the six-year registrar window. */
  declaredOn: string | null;
  source: string;
}

export interface FilingDoc {
  ownerId: string;
  flowType: FlowType;
  name: PersonName;
  variants: string[];
  bvn: string | null;
  nin: string | null;
  chn: string | null;
  address: string | null;
  contact: ContactDetails | null;
  bankName: string;
  accountNumber: string;
  photoPath: string | null;
  administrator: null | {
    name: PersonName;
    relationship: string;
    phone: string;
    email: string | null;
    address: string | null;
    photoPath: string | null;
    probateDocName: string;
    probateDocPath: string;
  };
  poa: { signaturePath: string; acks: { scopeOnly: boolean; noCustody: boolean; freeAlternative: boolean }; claimIds: string[]; signedAtLabel: string; revokedAt: null };
  mandate: { bankName: string; accountNumber: string; acks: { variable: boolean; noticeBeforeDebit: boolean }; status: "pending" | "active" | "cancelled"; provider: string | null };
  createdLabel: string;
}

/** What the browser posts to /api/claims/file once files are in Storage. */
export interface FilingPayload {
  flowType: FlowType;
  name: PersonName;
  variants: string[];
  bvn: string;
  nin: string;
  chn: string;
  address: string;
  contact: ContactDetails;
  photoPath: string | null;
  administrator: null | {
    name: PersonName;
    relationship: string;
    phone: string;
    email: string;
    address: string;
    photoPath: string | null;
    probateDocName: string;
    probateDocPath: string;
  };
  bankName: string;
  accountNumber: string;
  /** Register entry IDs only. Company, units and amount always come from the register. */
  entryIds: string[];
  signaturePath: string;
  poaAcks: boolean[];
  mandateAcks: boolean[];
}

export type ActionPayload = ClaimAction;

const CLAIM_FIELDS: (keyof Claim)[] = [
  "registerEntryId", "filingId", "ownerId", "ownerName", "company", "ticker", "registrar", "units", "years",
  "amount", "pocket", "confidence", "matchedOn", "matchNote", "status", "exceptionReason", "ref",
  "submittedOn", "paidOn", "chaseRequested", "events",
  "assigneeId", "assigneeName", "stateSince", "dueAt", "approvedBy", "submittedAt", "fee",
];

/** Firestore data to a Claim. Drops timestamps and anything else we didn't put there on purpose. */
export function claimFromData(id: string, d: any): Claim {
  const out: any = { id };
  for (const k of CLAIM_FIELDS) out[k] = d?.[k] ?? null;
  out.units = Number(out.units ?? 0);
  out.amount = Number(out.amount ?? 0);
  out.chaseRequested = !!out.chaseRequested;
  out.events = Array.isArray(out.events) ? out.events : [];
  out.ticker = out.ticker ?? "";
  out.matchedOn = out.matchedOn ?? "";
  out.matchNote = out.matchNote ?? "";
  return out as Claim;
}

/** A Claim to the fields we store. Timestamps are added by the caller. */
export function claimToData(c: Claim): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of CLAIM_FIELDS) out[k] = c[k] ?? null;
  return out;
}

export function pocketFor(declaredOn: string | null, now = new Date()): "registrar" | "uftf" {
  if (!declaredOn) return "registrar";
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 6);
  return new Date(declaredOn + "T00:00:00Z") < cutoff ? "uftf" : "registrar";
}
