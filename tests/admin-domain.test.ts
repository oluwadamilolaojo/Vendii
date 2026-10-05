import { describe, expect, it } from "vitest";
import { applyAction, fileWithClock, feeReference } from "@/lib/domain/actions";
import { claimAudit } from "@/lib/domain/audit";
import { moneySummary, readStatement, reconcile } from "@/lib/domain/money";
import { ACTION_PERMISSION, can, normaliseRole } from "@/lib/domain/permissions";
import { registrarStats, withDefaults } from "@/lib/domain/registrarDesk";
import { DEFAULT_SLA, addWorkingDays, needsEscalation, slaState } from "@/lib/domain/sla";
import type { Actor, Claim } from "@/lib/domain/types";

const reviewer: Actor = { id: "rev1", name: "Ngozi", role: "reviewer" };
const finance: Actor = { id: "fin1", name: "Chidi", role: "finance" };
const admin: Actor = { id: "adm1", name: "Dami", role: "admin" };
// Monday 5 October 2026, 10:00 Lagos
const MON = new Date("2026-10-05T09:00:00Z");

function claim(over: Partial<Claim> = {}): Claim {
  return {
    id: "claim-abc12345", ownerId: "u1", ownerName: "Adewale Ogunyemi", company: "Zenith Bank", ticker: "ZENITHBANK",
    registrar: "Veritas Registrars", units: 100, years: "FY2023", amount: 486250, pocket: "registrar", confidence: "high",
    matchedOn: "x", matchNote: "x", status: "draft", ref: null, submittedOn: null, paidOn: null, chaseRequested: false, events: [], ...over,
  };
}

const run = (c: Claim, ...steps: [Parameters<typeof applyAction>[1], Actor, Date?][]) =>
  steps.reduce((acc, [a, actor, now]) => applyAction(acc, a, { actor, now: now ?? MON }), c);

describe("SLA clock", () => {
  it("skips weekends", () => {
    const fri = new Date("2026-10-09T09:00:00Z");
    expect(addWorkingDays(fri, 1).toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(addWorkingDays(MON, 2).toISOString().slice(0, 10)).toBe("2026-10-07");
  });

  it("starts at filing, restarts on every status change, and a chase restarts the interval", () => {
    const filed = fileWithClock(claim(), { now: MON });
    expect(filed.status).toBe("review");
    expect(filed.dueAt!.slice(0, 10)).toBe("2026-10-07"); // 2 working days
    const approved = run(filed, [{ type: "approve" }, reviewer, new Date("2026-10-06T09:00:00Z")]);
    expect(approved.stateSince).toBe("2026-10-06T09:00:00.000Z");
    expect(approved.dueAt!.slice(0, 10)).toBe("2026-10-15"); // 7 working days from Tue
    const chased = run(approved, [{ type: "sendChase", message: { to: "x@y.z", subject: "s", body: "b" } }, reviewer, new Date("2026-10-14T09:00:00Z")]);
    expect(chased.dueAt!.slice(0, 10)).toBe("2026-10-23");
  });

  it("pulls the deadline in when the shareholder asks for a check-in", () => {
    const c = run(fileWithClock(claim(), { now: MON }), [{ type: "approve" }, reviewer]);
    const asked = applyAction(c, { type: "requestChase" }, { now: MON });
    expect(asked.dueAt!.slice(0, 10)).toBe("2026-10-06");
  });

  it("reads overdue and escalation", () => {
    expect(slaState({ dueAt: "2026-10-01T00:00:00Z" }, MON)).toBe("overdue");
    expect(slaState({ dueAt: null }, MON)).toBe("none");
    expect(needsEscalation({ status: "chasing", stateSince: "2026-09-01T00:00:00Z" }, DEFAULT_SLA, MON)).toBe(true);
    expect(needsEscalation({ status: "chasing", stateSince: "2026-10-01T00:00:00Z" }, DEFAULT_SLA, MON)).toBe(false);
  });
});

describe("roles", () => {
  it("reads the old single ops role as admin and anything unknown as shareholder", () => {
    expect(normaliseRole("ops")).toBe("admin");
    expect(normaliseRole("finance")).toBe("finance");
    expect(normaliseRole("superuser")).toBe("shareholder");
    expect(normaliseRole(undefined)).toBe("shareholder");
  });

  it("keeps finance away from approvals and identity documents, and agents away from money", () => {
    expect(can("finance", "claims.approve")).toBe(false);
    expect(can("finance", "filings.view")).toBe(false);
    expect(can("finance", "money.manage")).toBe(true);
    expect(can("agent", "money.manage")).toBe(false);
    expect(can("agent", "claims.approve")).toBe(false);
    expect(can("reviewer", "money.waive")).toBe(false);
    expect(can("admin", "money.waive")).toBe(true);
    expect(can("shareholder", "queue.view")).toBe(false);
    expect(ACTION_PERMISSION.waiveFee).toBe("money.waive");
  });
});

describe("fee lifecycle", () => {
  const collected = () => run(fileWithClock(claim(), { now: MON }), [{ type: "approve" }, reviewer], [{ type: "recordReceipt", ref: "VR/1" }, reviewer], [{ type: "recordCollection" }, finance]);

  it("won't let the approver take the fee", () => {
    const c = collected();
    expect(c.approvedBy).toBe("rev1");
    expect(() => applyAction(c, { type: "requestDebit" }, { actor: { ...reviewer, role: "admin" } })).toThrow(/someone else/);
    expect(() => applyAction(c, { type: "waiveFee", reason: "goodwill" }, { actor: { ...reviewer, role: "admin" } })).toThrow(/someone else/);
  });

  it("requests, fails with a retry date, retries, and collects", () => {
    let c = collected();
    expect(c.fee).toMatchObject({ status: "none", amount: 48625, reference: feeReference(c.id) });
    c = run(c, [{ type: "requestDebit" }, finance]);
    expect(c.fee).toMatchObject({ status: "requested", attempts: 1 });
    c = run(c, [{ type: "failDebit", reason: "Insufficient funds" }, finance]);
    expect(c.fee).toMatchObject({ status: "failed", lastError: "Insufficient funds" });
    expect(c.fee!.nextRetryAt!.slice(0, 10)).toBe("2026-10-08");
    expect(c.status).toBe("collected");
    expect(c.events.at(-1)!.title).toMatch(/didn't go through/);
    expect(() => run(c, [{ type: "debitFee" }, finance])).toThrow(/Request it again/);
    c = run(c, [{ type: "requestDebit" }, finance], [{ type: "debitFee" }, finance]);
    expect(c.status).toBe("paid");
    expect(c.fee).toMatchObject({ status: "collected", attempts: 2 });
  });

  it("waives with a reason and closes the claim, telling the shareholder", () => {
    const c = run(collected(), [{ type: "waiveFee", reason: "Hardship" }, admin]);
    expect(c.status).toBe("paid");
    expect(c.fee).toMatchObject({ status: "waived", waivedReason: "Hardship" });
    expect(c.events.at(-1)!.note).toMatch(/keep the full/);
    expect(() => run(collected(), [{ type: "waiveFee", reason: " " }, admin])).toThrow(/reason/);
  });

  it("writes a readable audit line with the status move", () => {
    const before = collected();
    const after = applyAction(before, { type: "requestDebit" }, { actor: finance, now: MON });
    const a = claimAudit({ type: "requestDebit" }, before, after, finance, MON);
    expect(a.summary).toMatch(/Requested fee debit VND-.* of ₦48,625 on Zenith Bank for Adewale Ogunyemi \(attempt 1\)/);
    expect(a).toMatchObject({ actorId: "fin1", action: "claim.requestDebit", claimId: before.id });
  });
});

describe("money room", () => {
  const paid = (id: string, amount: number, ref?: string): Claim =>
    claim({ id, amount, status: "paid", fee: { status: "collected", amount: amount / 10, reference: ref ?? feeReference(id), attempts: 1, lastError: null, nextRetryAt: null, requestedAt: null, settledAt: null, waivedReason: null } });

  it("matches fees to a bank statement and catches the one marked collected that never landed", () => {
    const claims = [paid("a1111111", 100000), paid("b2222222", 200000), paid("c3333333", 50000), paid("d4444444", 70000)];
    const csv = [
      "Trans Date,Narration,Debit,Credit,Balance",
      `06-Oct-2026,"NIBSS DD ${feeReference("a1111111")} OGUNYEMI",,"10,000.00",1`,
      `06-Oct-2026,NIBSS DD ${feeReference("b2222222")},,19000.00,1`,
      "07-Oct-2026,NIBSS DD NO REF,,5000.00,1",
      "07-Oct-2026,POS SETTLEMENT,,1234.00,1",
      "07-Oct-2026,BANK CHARGES,52.50,,1",
    ].join("\n");
    const { lines, error } = readStatement(csv);
    expect(error).toBeNull();
    expect(lines).toHaveLength(4);
    const r = reconcile(claims, lines);
    expect(r.matched.map((m) => [m.claim.id, m.how])).toEqual([["a1111111", "reference"], ["c3333333", "amount"]]);
    expect(r.amountMismatch.map((m) => m.claim.id)).toEqual(["b2222222"]);
    expect(r.missingFromStatement.map((c) => c.id)).toEqual(["d4444444"]);
    expect(r.unknownCredits.map((l) => l.narration)).toEqual(["POS SETTLEMENT"]);
  });

  it("explains a statement it can't read", () => {
    expect(readStatement("foo,bar\n1,2").error).toMatch(/date, the credit amount and the narration/);
  });

  it("totals the money", () => {
    const s = moneySummary([paid("a", 100000), claim({ id: "b", status: "collected", amount: 50000 })], MON);
    expect(s).toMatchObject({ recovered: 150000, feesCollected: 10000, feesOutstanding: 5000, netToShareholders: 140000 });
  });
});

describe("registrar desk", () => {
  it("always lists all 21 registrars, with saved edits layered on", () => {
    const all = withDefaults([{ ...withDefaults([])[0], notes: "Call Ideri first", requirements: { ...withDefaults([])[0].requirements, wetInkSignature: true } }]);
    expect(all).toHaveLength(21);
    expect(all[0].notes).toBe("Call Ideri first");
    expect(all[0].requirements.wetInkSignature).toBe(true);
    expect(all[0].requirements.bankStamp).toBeNull();
  });

  it("measures acceptance, days to pay and rejection reasons", () => {
    const sub = "2026-09-01T09:00:00Z";
    const claims = [
      claim({ id: "1", status: "paid", submittedAt: sub, stateSince: "2026-09-21T09:00:00Z" }),
      claim({ id: "2", status: "paid", submittedAt: sub, stateSince: "2026-10-01T09:00:00Z" }),
      claim({ id: "3", status: "rejected", events: [{ id: "e", title: "Rejected", state: "bad", dateLabel: "x", note: "Shares transferred out in 2019. No fee charged." }] }),
      claim({ id: "4", status: "chasing", submittedAt: sub, stateSince: sub, dueAt: "2026-09-15T00:00:00Z" }),
    ];
    const s = registrarStats(claims, DEFAULT_SLA, MON);
    expect(s).toMatchObject({ open: 1, paid: 2, rejected: 1, overdue: 1, escalate: 1, medianDaysToPay: 25, oldestOpenDays: 34 });
    expect(s.acceptanceRate).toBeCloseTo(2 / 3);
    expect(s.rejectionReasons).toEqual([{ reason: "Shares transferred out in 2019.", count: 1 }]);
  });
});

describe("fields written by actions survive an existing value", () => {
  it("re-approving after an exception records the new approver, not the old one", () => {
    const c = claim({ status: "review", approvedBy: "someone-earlier", fee: null });
    expect(applyAction(c, { type: "approve" }, { actor: reviewer, now: MON }).approvedBy).toBe("rev1");
  });
});
