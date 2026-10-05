import type { ClaimEvent } from "./types";

/** Close out the current step. Optionally drop steps that will no longer happen. */
export function settleTimeline(events: ClaimEvent[], opts: { dropPending?: boolean } = {}): ClaimEvent[] {
  return events
    .filter((e) => !(opts.dropPending && e.state === "wait"))
    .map((e) => (e.state === "now" ? { ...e, state: "done" as const } : e));
}

/** New events go before anything still waiting, so future steps stay at the bottom. */
export function appendEvents(events: ClaimEvent[], added: ClaimEvent[]): ClaimEvent[] {
  const firstWait = events.findIndex((e) => e.state === "wait");
  if (firstWait < 0) return [...events, ...added];
  return [...events.slice(0, firstWait), ...added, ...events.slice(firstWait)];
}
