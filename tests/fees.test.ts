import { describe, expect, it } from "vitest";
import { feeFor, netFor } from "@/lib/domain/fees";

describe("success fee", () => {
  it("is 10% of what actually arrives", () => {
    expect(feeFor(486250)).toBe(48625);
    expect(netFor(486250)).toBe(437625);
  });
  it("is nothing when nothing is recovered", () => {
    expect(feeFor(0)).toBe(0);
    expect(feeFor(-100)).toBe(0);
    expect(feeFor(Number.NaN)).toBe(0);
    expect(netFor(0)).toBe(0);
  });
  it("rounds to whole naira and fee plus net equals gross", () => {
    expect(feeFor(27005)).toBe(2701);
    for (const g of [1, 99, 150, 27005, 1432000, 58900]) expect(feeFor(g) + netFor(g)).toBe(g);
  });
});
