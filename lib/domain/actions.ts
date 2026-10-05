import { assertTransition } from "./claimStatus";
import { feeFor, naira, netFor } from "./fees";
import { appendEvents, settleTimeline } from "./timeline";
import type { Claim, ClaimEvent, ClaimStatus, EventState, OutboundMessage } from "./types";
import { inDays, today, uid } from "@/lib/util";

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

export function approve(c: Claim): Claim {
  return {
    ...move(c, "submitted", [
      ev(`Filed with ${c.registrar}`, "done", "Claim pack sent under your signed authority."),
      ev("Receipt confirmation", "now", "We chase this at day 7 if nothing arrives.", `Expected by ${inDays(7)}`),
      ev("Payment to your account", "wait", null, "Not started"),
    ], true),
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

export function recordCollection(c: Claim): Claim {
  return {
    ...move(c, "collected", [
      ev("Registrar paid your account", "done", `${naira(c.amount)} credited by ${c.registrar} directly to your bank account.`),
      ev("Fee notice sent", "now", `We told you the exact fee, ${naira(feeFor(c.amount))}, before debiting it.`),
    ], true),
    chaseRequested: false,
  };
}

export function debitFee(c: Claim): Claim {
  return {
    ...move(c, "paid", [
      ev("Fee debited via NIBSS mandate", "done", `${naira(feeFor(c.amount))} debited, as notified. Net received: ${naira(netFor(c.amount))}.`),
    ], true),
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
  | { type: "debitFee" }
  | { type: "reject"; reason: string }
  | { type: "raiseException"; reason: string };
export type ClaimAction = OwnerAction | OpsAction;

export const OWNER_ACTIONS: readonly ClaimAction["type"][] = ["requestChase", "resolveException"];

export function applyAction(c: Claim, a: ClaimAction): Claim {
  switch (a.type) {
    case "requestChase": return requestChase(c);
    case "resolveException": return resolveException(c);
    case "approve": return approve(c);
    case "recordReceipt": return recordReceipt(c, a.ref);
    case "sendChase": return sendChase(c, a.message);
    case "recordCollection": return recordCollection(c);
    case "debitFee": return debitFee(c);
    case "reject": return reject(c, a.reason);
    case "raiseException": return raiseException(c, a.reason);
  }
}
