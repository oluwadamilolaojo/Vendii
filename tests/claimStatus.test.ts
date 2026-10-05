import { describe, expect, it } from "vitest";
import { TERMINAL, TRANSITIONS, assertTransition, canTransition } from "@/lib/domain/claimStatus";
import type { ClaimStatus } from "@/lib/domain/types";

describe("claim state machine", () => {
  it("never lets a closed claim move", () => {
    for (const t of TERMINAL) expect(TRANSITIONS[t]).toHaveLength(0);
    expect(() => assertTransition("paid", "chasing")).toThrow();
  });
  it("only debits the fee after the registrar has paid", () => {
    expect(canTransition("chasing", "paid")).toBe(false);
    expect(canTransition("collected", "paid")).toBe(true);
  });
  it("sends every filed claim through human review first", () => {
    expect(canTransition("draft", "submitted")).toBe(false);
    expect(canTransition("draft", "review")).toBe(true);
  });
  it("gives every open status a route to a terminal state", () => {
    const reaches = (s: ClaimStatus, seen = new Set<ClaimStatus>()): boolean => {
      if (TERMINAL.includes(s)) return true;
      if (seen.has(s)) return false;
      seen.add(s);
      return TRANSITIONS[s].some((n) => reaches(n, seen));
    };
    for (const s of Object.keys(TRANSITIONS) as ClaimStatus[]) expect(reaches(s)).toBe(true);
  });
});
