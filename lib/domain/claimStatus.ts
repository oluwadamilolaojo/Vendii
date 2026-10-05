import type { ClaimStatus } from "./types";

/**
 * The claim state machine. Mirrored in SQL (claim_transitions) so the database
 * refuses the same moves the UI refuses. Every claim ends paid, rejected with a
 * reason, or on a named exception path. Nothing is allowed to sit silent.
 */
export const TRANSITIONS: Record<ClaimStatus, readonly ClaimStatus[]> = {
  draft: ["review", "hold"],
  review: ["submitted", "exception", "rejected"],
  submitted: ["chasing", "exception", "collected", "rejected"],
  chasing: ["exception", "collected", "rejected", "hold"],
  exception: ["review", "chasing", "rejected"],
  hold: ["review", "rejected"],
  collected: ["paid"],
  paid: [],
  rejected: [],
};

export const TERMINAL: readonly ClaimStatus[] = ["paid", "rejected"];

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ClaimStatus, to: ClaimStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`A claim can't move from "${STATUS_LABEL[from]}" to "${STATUS_LABEL[to]}".`);
  }
}

export function isClosed(s: ClaimStatus): boolean {
  return TERMINAL.includes(s);
}

export function isActive(s: ClaimStatus): boolean {
  return !isClosed(s) && s !== "draft";
}

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  draft: "Not filed",
  review: "Being reviewed",
  submitted: "Filed",
  chasing: "In progress",
  exception: "Needs you",
  hold: "On hold",
  collected: "Payment received",
  paid: "Paid",
  rejected: "Closed",
};

export type Tone = "gold" | "teal" | "red" | "navy" | "plain";

export const STATUS_TONE: Record<ClaimStatus, Tone> = {
  draft: "plain",
  review: "navy",
  submitted: "navy",
  chasing: "gold",
  exception: "red",
  hold: "gold",
  collected: "gold",
  paid: "teal",
  rejected: "plain",
};
