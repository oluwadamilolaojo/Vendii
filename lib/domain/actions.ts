import { assertTransition } from "./claimStatus";
import { feeFor, naira, netFor } from "./fees";
import { appendEvents, settleTimeline } from "./timeline";
import { PermissionError } from "./errors";
import { DEFAULT_SLA, addWorkingDays, dueFor } from "./sla";
import type { Actor, Claim, ClaimEvent, ClaimStatus, EventState, FeeState, OutboundMessage, SlaPolicy } from "./types";
import { inDays, today, uid } from "@/lib/util";

/** Who is acting, when, and under which SLA policy. Optional so old callers and tests keep working. */
export interface ActionContext {
  actor?: Actor | null;
  now?: Date;
  sla?: SlaPolicy;
  /** Set when the action runs as part of a bulk selection. Some actions need individual attention. */
  bulk?: boolean;
}

/**
 * Every change a claim can go through, as pure functions. The browser mock and the
 * Firebase server routes both call these, so the timeline copy and the state machine
 * live in exactly one place. Each function throws if the move isn't allowed.
 */

export const HOLD_NOTE =
  "Dividends older than six years pass to the Unclaimed Funds Trust Fund under the Finance Act 2020. " +
  "The Fund is not yet operational, so the registrar still holds these under SEC interim guidance. " +
  "We file when the route is confirmed, and you are charged nothing meanwhile.";

export const ev = (title: string, state: EventState, note?: string | null, dateLabel?: string): ClaimEvent =>
  ({ id: uid(), title, state, note: note ?? null, dateLabel: dateLabel ?? today() });

function move(c: Claim, to: ClaimStatus, added: ClaimEvent[], dropPending = false): Claim {
  assertTransition(c.status, to);
  return { ...c, status: to, events: appendEvents(settleTimeline(c.events, { dropPending }), added) };
}

function required(value: string | undefined | null, message: string): string {
  const v = (value ?? "").trim();
  if (!v) throw new Error(message);
  return v;
}

/** A found claim, filed. Registrar-window claims go to human review; older ones go on hold. */
export function fileOne(c: Claim): Claim {
  if (c.pocket === "uftf") {
    return move(c, "hold", [ev("Identified in your claim map", "done"), ev("On hold", "now", HOLD_NOTE, "Now")]);
  }
  return move(c, "review", [
    ev("Claim pack received", "done", `Authority signed and pack assembled for ${c.registrar}.`),
    ev("Human review", "now", "A person here checks every pack before it goes to the registrar.", "Usually 1 to 2 working days"),
    ev(`Filed with ${c.registrar}`, "wait", null, "Not started"),
    ev("Payment to your account", "wait", null, "Not started"),
  ]);
}

// ------------------------------------------------------------------ shareholder actions

export function requestChase(c: Claim): Claim {
  if (c.chaseRequested) return c;
  if (!["submitted", "chasing"].includes(c.status)) throw new Error("Only filed claims can be chased.");
  return {
    ...c,
    chaseRequested: true,
    events: appendEvents(c.events, [ev("You requested a status check", "done", `We'll contact ${c.registrar} and update you here.`)]),
  };
}

export function resolveException(c: Claim): Claim {
  if (c.status !== "exception") throw new Error("This claim has no open exception.");
  const signed = ev("Affidavit of name variation signed", "done", "Sworn and anchored to your NIN.");
  const c2 = { ...c, exceptionReason: null };
  return c.ref
    ? move(c2, "chasing", [signed, ev(`Resubmitted to ${c.registrar}`, "now", "We follow up in a week.")])
    : move(c2, "review", [signed, ev("Human review", "now", "A person here checks the updated pack before it goes out.")]);
}

// ------------------------------------------------------------------ ops actions

export function approve(c: Claim, ctx: ActionContext = {}): Claim {
  // Bulk approval is for clean matches. Anything less gets opened and looked at on its own.
  if (ctx.bulk && c.status === "review" && c.confidence !== "high") throw new Error(`${c.confidence[0].toUpperCase()}${c.confidence.slice(1)}-confidence match: open it and approve it on its own.`);
  return {
    ...move(c, "submitted", [
      ev(`Filed with ${c.registrar}`, "done", "Claim pack sent under your signed authority."),
      ev("Receipt confirmation", "now", "We chase this at day 7 if nothing arrives.", `Expected by ${inDays(7)}`),
      ev("Payment to your account", "wait", null, "Not started"),
    ], true),
    approvedBy: ctx.actor?.id ?? c.approvedBy ?? null,
    submittedAt: (ctx.now ?? new Date()).toISOString(),
    submittedOn: today(),
  };
}

export function recordReceipt(c: Claim, ref: string): Claim {
  const r = required(ref, "A registrar reference is required.");
  return {
    ...move(c, "chasing", [
      ev("Receipt confirmed", "done", `Reference ${r} issued.`),
      ev("Verification with the registrar", "now", "Status checks every two weeks. Escalation to a named contact after four weeks of silence."),
    ]),
    ref: r,
  };
}

export function sendChase(c: Claim, message: OutboundMessage): Claim {
  if (!["submitted", "chasing"].includes(c.status)) throw new Error("Only filed claims can be chased.");
  required(message.to, "Add the registrar's email address.");
  return {
    ...c,
    chaseRequested: false,
    events: appendEvents(c.events, [ev("Chase message sent", "done", `Sent to ${message.to || c.registrar} asking for a status update.`)]),
  };
}

/** Reference quoted on the NIBSS debit, so it can be found on the bank statement. */
export function feeReference(claimId: string): string {
  // Two FNV-1a passes with different seeds over the whole id: ten characters, no visual
  // look-alikes (0/O, 1/I), stable for the life of the claim. Never derived from a slice of the
  // id, which made claims with similar ids share a reference and broke reconciliation.
  const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const pass = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < claimId.length; i++) { h ^= claimId.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    let out = "";
    for (let i = 0; i < 5; i++) { out += ALPHA[h & 31]; h >>>= 5; }
    return out;
  };
  return `VND-${pass(2166136261)}${pass(0x9747b28c)}`;
}

export function newFee(c: Claim): FeeState {
  return { status: "none", amount: feeFor(c.amount), reference: feeReference(c.id), attempts: 0, lastError: null, nextRetryAt: null, requestedAt: null, settledAt: null, waivedReason: null };
}

export function recordCollection(c: Claim): Claim {
  return {
    ...move(c, "collected", [
      ev("Registrar paid your account", "done", `${naira(c.amount)} credited by ${c.registrar} directly to your bank account.`),
      ev("Fee notice sent", "now", `We told you the exact fee, ${naira(feeFor(c.amount))}, before debiting it.`),
    ], true),
    fee: newFee(c),
    chaseRequested: false,
  };
}

function feeOf(c: Claim): FeeState {
  return c.fee ?? newFee(c);
}

/** Separation of duties: whoever approved a pack can't also take money on it. */
function notApprover(c: Claim, ctx: ActionContext, what: string) {
  if (ctx.actor && c.approvedBy && ctx.actor.id === c.approvedBy) {
    throw new PermissionError(`You approved this claim, so someone else has to ${what}.`);
  }
}

export function requestDebit(c: Claim, ctx: ActionContext = {}): Claim {
  if (c.status !== "collected") throw new Error("The fee can only be debited once the registrar has paid.");
  notApprover(c, ctx, "debit its fee");
  const f = feeOf(c);
  if (!["none", "failed"].includes(f.status)) throw new Error(f.status === "requested" ? "A debit is already in progress." : "This fee is already settled.");
  const now = (ctx.now ?? new Date()).toISOString();
  return { ...c, fee: { ...f, status: "requested", attempts: f.attempts + 1, requestedAt: now, nextRetryAt: null, lastError: null } };
}

export function failDebit(c: Claim, reason: string, ctx: ActionContext = {}): Claim {
  const r = required(reason, "Say why the debit failed, e.g. insufficient funds.");
  const f = feeOf(c);
  if (c.status !== "collected" || f.status !== "requested") throw new Error("Only a debit that's in progress can fail.");
  const retry = addWorkingDays(ctx.now ?? new Date(), 3);
  const retryLabel = retry.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
  return {
    ...c,
    fee: { ...f, status: "failed", lastError: r, nextRetryAt: retry.toISOString() },
    events: appendEvents(c.events, [ev("Fee debit didn't go through", "bad", `Nothing was taken. We'll try again on ${retryLabel}, so please keep ${naira(f.amount)} in the account.`)]),
  };
}

export function waiveFee(c: Claim, reason: string, ctx: ActionContext = {}): Claim {
  const r = required(reason, "A reason is needed to waive a fee.");
  if (c.status !== "collected") throw new Error("A fee can only be waived once the registrar has paid.");
  notApprover(c, ctx, "waive its fee");
  const f = feeOf(c);
  if (f.status === "collected") throw new Error("This fee has already been collected.");
  return {
    ...move(c, "paid", [ev("Fee waived", "done", `You keep the full ${naira(c.amount)}. No debit will be made.`)], true),
    paidOn: today(),
    fee: { ...f, status: "waived", waivedReason: r, settledAt: (ctx.now ?? new Date()).toISOString(), nextRetryAt: null },
  };
}

export function assign(c: Claim, assignee: { id: string; name: string } | null): Claim {
  if (["paid", "rejected"].includes(c.status)) throw new Error("Closed claims can't be assigned.");
  return { ...c, assigneeId: assignee?.id ?? null, assigneeName: assignee?.name ?? null };
}

export function debitFee(c: Claim, ctx: ActionContext = {}): Claim {
  if (c.status !== "collected") throw new Error("The fee can only be debited once the registrar has paid.");
  notApprover(c, ctx, "debit its fee");
  const f = feeOf(c);
  if (!["none", "requested"].includes(f.status)) {
    throw new Error(f.status === "failed" ? "The last debit failed. Request it again before recording success." : "This fee is already settled.");
  }
  return {
    ...move(c, "paid", [
      ev("Fee debited via NIBSS mandate", "done", `${naira(feeFor(c.amount))} debited, as notified. Net received: ${naira(netFor(c.amount))}.`),
    ], true),
    fee: { ...f, status: "collected", settledAt: (ctx.now ?? new Date()).toISOString(), nextRetryAt: null, lastError: null },
    paidOn: today(),
  };
}

export function reject(c: Claim, reason: string): Claim {
  const r = required(reason, "A written reason is required to close a claim.");
  return { ...move(c, "rejected", [ev("Rejected", "bad", `${r} No fee charged.`)], true), chaseRequested: false };
}

export function raiseException(c: Claim, reason: string): Claim {
  const r = required(reason, "Say what is needed from the shareholder.");
  return {
    ...move(c, "exception", [
      ev(r, "bad"),
      ev("Waiting on you", "now", "We've drafted what is needed. Open this claim to finish it.", "Now"),
    ]),
    exceptionReason: r,
  };
}

// ------------------------------------------------------------------ the action vocabulary

export type OwnerAction = { type: "requestChase" } | { type: "resolveException" };
export type OpsAction =
  | { type: "approve" }
  | { type: "recordReceipt"; ref: string }
  | { type: "sendChase"; message: OutboundMessage }
  | { type: "recordCollection" }
  | { type: "requestDebit" }
  | { type: "failDebit"; reason: string }
  | { type: "debitFee" }
  | { type: "waiveFee"; reason: string }
  | { type: "reject"; reason: string }
  | { type: "raiseException"; reason: string }
  | { type: "assign"; assignee: { id: string; name: string } | null };
export type ClaimAction = OwnerAction | OpsAction;

export const OWNER_ACTIONS: readonly ClaimAction["type"][] = ["requestChase", "resolveException"];

function apply(c: Claim, a: ClaimAction, ctx: ActionContext): Claim {
  switch (a.type) {
    case "requestChase": return requestChase(c);
    case "resolveException": return resolveException(c);
    case "approve": return approve(c, ctx);
    case "recordReceipt": return recordReceipt(c, a.ref);
    case "sendChase": return sendChase(c, a.message);
    case "recordCollection": return recordCollection(c);
    case "requestDebit": return requestDebit(c, ctx);
    case "failDebit": return failDebit(c, a.reason, ctx);
    case "debitFee": return debitFee(c, ctx);
    case "waiveFee": return waiveFee(c, a.reason, ctx);
    case "reject": return reject(c, a.reason);
    case "raiseException": return raiseException(c, a.reason);
    case "assign": return assign(c, a.assignee);
  }
}

/**
 * Runs an action and keeps the SLA clock honest: a status change restarts the clock, a chase
 * restarts the chase interval, and a shareholder's check-in request pulls the deadline in to
 * the next working day.
 */
/** Events written "today" get the action's own date, so a back-dated or delayed action is labelled truthfully. */
function dateNewEvents(before: Claim, after: Claim, now: Date): Claim {
  const seen = new Set(before.events.map((e) => e.id));
  const label = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
  const t = today();
  if (label === t) return after;
  return { ...after, events: after.events.map((e) => (!seen.has(e.id) && e.dateLabel === t ? { ...e, dateLabel: label } : e)) };
}

export function applyAction(c: Claim, a: ClaimAction, ctx: ActionContext = {}): Claim {
  const now = ctx.now ?? new Date();
  const sla = ctx.sla ?? DEFAULT_SLA;
  const next = dateNewEvents(c, apply(c, a, ctx), now);
  if (next.status !== c.status) return { ...next, stateSince: now.toISOString(), dueAt: dueFor(next.status, now, sla) };
  if (a.type === "sendChase") return { ...next, dueAt: dueFor(next.status, now, sla) };
  if (a.type === "requestChase" && next.chaseRequested && !c.chaseRequested) {
    const soon = addWorkingDays(now, 1).toISOString();
    return { ...next, dueAt: !next.dueAt || soon < next.dueAt ? soon : next.dueAt };
  }
  return next;
}

/** Filing puts a claim on the clock for the first time. */
export function fileWithClock(c: Claim, ctx: ActionContext = {}): Claim {
  const now = ctx.now ?? new Date();
  const filed = dateNewEvents(c, fileOne(c), now);
  return { ...filed, stateSince: now.toISOString(), dueAt: dueFor(filed.status, now, ctx.sla ?? DEFAULT_SLA) };
}
