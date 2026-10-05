import type { ClaimAction } from "./actions";
import { naira } from "./fees";
import { STATUS_LABEL } from "./claimStatus";
import type { Actor, AuditEntry, Claim } from "./types";
import { uid } from "@/lib/util";

/**
 * One line per thing a person did. Written by the same code path that made the change, in the
 * same transaction on Firebase, so the log can't drift from what actually happened.
 */
export function claimAuditSummary(a: ClaimAction, before: Claim, after: Claim): string {
  const where = `${before.company} for ${before.ownerName}`;
  switch (a.type) {
    case "approve": return `Approved ${where} and filed with ${before.registrar}`;
    case "recordReceipt": return `Recorded receipt ${a.ref.trim()} from ${before.registrar} on ${where}`;
    case "sendChase": return `Sent a chase to ${a.message.to} on ${where}`;
    case "recordCollection": return `Recorded ${naira(before.amount)} paid by ${before.registrar} on ${where}`;
    case "requestDebit": return `Requested fee debit ${after.fee?.reference ?? ""} of ${naira(after.fee?.amount ?? 0)} on ${where} (attempt ${after.fee?.attempts ?? 1})`;
    case "failDebit": return `Recorded failed fee debit on ${where}: ${a.reason.trim()}`;
    case "debitFee": return `Recorded fee of ${naira(after.fee?.amount ?? 0)} collected on ${where}`;
    case "waiveFee": return `Waived the ${naira(before.fee?.amount ?? 0)} fee on ${where}: ${a.reason.trim()}`;
    case "reject": return `Closed ${where} as rejected: ${a.reason.trim()}`;
    case "raiseException": return `Raised an exception on ${where}: ${a.reason.trim()}`;
    case "assign": return a.assignee ? `Assigned ${where} to ${a.assignee.name}` : `Unassigned ${where}`;
    case "requestChase": return `Shareholder asked for a status check on ${where}`;
    case "resolveException": return `Shareholder resolved the exception on ${where}`;
  }
}

export function claimAudit(a: ClaimAction, before: Claim, after: Claim, actor: Actor, now = new Date()): AuditEntry {
  return {
    id: uid(), at: now.toISOString(), actorId: actor.id, actorName: actor.name, actorRole: actor.role,
    action: `claim.${a.type}`, summary: claimAuditSummary(a, before, after),
    claimId: before.id, filingId: before.filingId ?? null, registrarId: null,
    from: before.status !== after.status ? before.status : null, to: before.status !== after.status ? after.status : null,
  };
}

export function auditEntry(actor: Actor, action: string, summary: string, refs: Partial<Pick<AuditEntry, "claimId" | "filingId" | "registrarId">> = {}, now = new Date()): AuditEntry {
  return { id: uid(), at: now.toISOString(), actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, summary, claimId: refs.claimId ?? null, filingId: refs.filingId ?? null, registrarId: refs.registrarId ?? null, from: null, to: null };
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "claim.approve": "Approved", "claim.recordReceipt": "Receipt", "claim.sendChase": "Chase", "claim.recordCollection": "Registrar paid",
  "claim.requestDebit": "Debit requested", "claim.failDebit": "Debit failed", "claim.debitFee": "Fee collected", "claim.waiveFee": "Fee waived",
  "claim.reject": "Rejected", "claim.raiseException": "Exception", "claim.assign": "Assignment", "claim.requestChase": "Check-in request",
  "claim.resolveException": "Exception resolved", "claim.file": "Filed", "filing.view": "Viewed ID", "forms.generate": "Forms generated",
  "registrar.update": "Registrar edited", "team.setRole": "Role change", "settings.update": "Settings",
};

export const statusText = (s: AuditEntry["from"]) => (s ? STATUS_LABEL[s] : "");
