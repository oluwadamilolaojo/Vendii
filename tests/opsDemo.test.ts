import { describe, expect, it } from "vitest";
import { buildOpsDemo } from "@/lib/data/opsDemo";
import { bucketOf, moneySummary } from "@/lib/domain/money";
import { registrarStats } from "@/lib/domain/registrarDesk";
import { slaState } from "@/lib/domain/sla";

describe("admin demo data", () => {
  const now = new Date("2026-10-05T09:00:00Z");
  const { claims, filings, audit } = buildOpsDemo(now);

  it("covers every state the portal shows, through the real actions", () => {
    const statuses = new Set(claims.map((c) => c.status));
    for (const s of ["review", "submitted", "chasing", "exception", "collected", "paid", "rejected"]) expect(statuses).toContain(s);
    expect(new Set(claims.map(bucketOf).filter(Boolean))).toEqual(new Set(["toRequest", "inFlight", "failed", "collected", "waived"]));
    expect(claims.some((c) => slaState(c, now) === "overdue")).toBe(true);
    expect(claims.some((c) => c.assigneeId)).toBe(true);
    expect(claims.some((c) => !c.assigneeId)).toBe(true);
    expect(filings).toHaveLength(claims.length);
  });

  it("leaves a coherent trail: approver recorded, fees right, audit for every step", () => {
    for (const c of claims.filter((c) => c.submittedAt)) expect(c.approvedBy).toBe("mock-staff-reviewer");
    expect(audit.length).toBeGreaterThan(40);
    const s = moneySummary(claims, now);
    expect(s.feesCollected).toBe(52000 + 17500 + 31000);
    expect(registrarStats(claims.filter((c) => c.registrar === "Coronation Registrars")).rejected).toBe(1);
  });
});

describe("fee references", () => {
  it("are unique even for claims whose ids end the same way", async () => {
    const { feeReference } = await import("@/lib/domain/actions");
    const ids = [...buildOpsDemo().claims.map((c) => c.id), ...Array.from({ length: 5000 }, (_, i) => `claim-${i}-cardinalstone`)];
    const refs = new Set(ids.map(feeReference));
    expect(refs.size).toBe(ids.length);
    expect(feeReference("abc")).toMatch(/^VND-[2-9A-HJ-NP-Z]{10}$/);
    expect(feeReference("abc")).toBe(feeReference("abc"));
  });
});
