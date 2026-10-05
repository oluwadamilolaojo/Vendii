import type { Claim, ClaimStatus, SlaPolicy } from "./types";

/**
 * Working days allowed per status. These are starting points for the pilot; admins change
 * them in settings once real registrar turnaround is known.
 *   review     a person here checks the pack
 *   submitted  registrar acknowledges receipt; chase at the deadline
 *   chasing    time between status checks; each chase restarts it
 *   exception  waiting on the shareholder; nudge them at the deadline
 *   collected  registrar has paid; the fee should be debited by then
 */
export const DEFAULT_SLA: SlaPolicy = { review: 2, submitted: 7, chasing: 10, exception: 10, collected: 3, escalateAfter: 20 };

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // Africa/Lagos is UTC+1 all year, no daylight saving

function lagosDay(d: Date): number {
  return new Date(d.getTime() + LAGOS_OFFSET_MS).getUTCDay();
}

/** Adds working days (Monday to Friday, Lagos time). Public holidays aren't modelled yet. */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let left = Math.max(0, Math.round(days));
  while (left > 0) {
    d.setTime(d.getTime() + 24 * 60 * 60 * 1000);
    const wd = lagosDay(d);
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export function workingDaysBetween(a: Date, b: Date): number {
  if (b <= a) return 0;
  let n = 0;
  const d = new Date(a.getTime());
  while (d < b) {
    d.setTime(d.getTime() + 24 * 60 * 60 * 1000);
    if (d > b) break;
    const wd = lagosDay(d);
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

const CLOCKED: Partial<Record<ClaimStatus, keyof SlaPolicy>> = {
  review: "review", submitted: "submitted", chasing: "chasing", exception: "exception", collected: "collected",
};

/** Deadline for a status entered at `from`, or null if nothing is owed in that status. */
export function dueFor(status: ClaimStatus, from: Date, sla: SlaPolicy): string | null {
  const k = CLOCKED[status];
  return k ? addWorkingDays(from, sla[k]).toISOString() : null;
}

export type SlaState = "overdue" | "today" | "soon" | "ok" | "none";

/** Calendar days between two instants, counted in Lagos time, so "today" means today in Lagos. */
function lagosDayDiff(from: Date, to: Date): number {
  const d = (x: Date) => Math.floor((x.getTime() + LAGOS_OFFSET_MS) / 864e5);
  return d(to) - d(from);
}

/** One rule for both the colour and the words, so a "Due today" count never disagrees with a row. */
export function slaState(c: Pick<Claim, "dueAt">, now = new Date()): SlaState {
  if (!c.dueAt) return "none";
  const due = new Date(c.dueAt);
  if (due < now) return "overdue";
  const days = lagosDayDiff(now, due);
  if (days === 0) return "today";
  if (days <= 2) return "soon";
  return "ok";
}

/** A claim chasing longer than the escalation threshold goes to the registrar's named contact. */
export function needsEscalation(c: Pick<Claim, "status" | "stateSince">, sla: SlaPolicy, now = new Date()): boolean {
  if (c.status !== "chasing" || !c.stateSince) return false;
  return workingDaysBetween(new Date(c.stateSince), now) >= sla.escalateAfter;
}

export function dueLabel(c: Pick<Claim, "dueAt">, now = new Date()): string {
  if (!c.dueAt) return "No deadline";
  const due = new Date(c.dueAt);
  const days = lagosDayDiff(now, due);
  if (due < now) return days >= 0 ? "Overdue today" : days === -1 ? "1 day overdue" : `${-days} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export function ageInDays(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 864e5));
}
