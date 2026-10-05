import { beforeEach, describe, expect, it } from "vitest";

// Minimal browser shim so the mock repository runs under Node.
const store = new Map<string, string>();
(globalThis as any).window = Object.assign(new EventTarget(), {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

const { mockSignInAs } = await import("@/lib/auth/mock");
const { mockRepository: repo } = await import("@/lib/data/mock");

const name = { first: "Adewale", middle: "Bamidele", last: "Ogunyemi" };

async function fileAll() {
  const candidates = await repo.searchRegisters({ name, variants: ["A. B. Ogunyemi"] });
  const selectedIds = candidates.filter((c) => c.pocket === "registrar").map((c) => c.id);
  return repo.fileClaims({
    flowType: "own", name, variants: ["A. B. Ogunyemi"], bvn: "22154874718", nin: "", chn: "", address: "Ikoyi", contact: { city: "Ikoyi", state: "Lagos", previousAddress: "", phone: "", email: "" },
    photo: null, administrator: null, bankName: "Guaranty Trust Bank", accountNumber: "0123456213",
    candidates, selectedIds, signature: "data:image/png;base64,x", poaAcks: [true, true, true], mandateAcks: [true, true],
  });
}

describe("claim lifecycle on the mock repository", () => {
  beforeEach(() => store.clear());

  it("runs review, filing, receipt, payment and fee debit in order", async () => {
    mockSignInAs("+2348031234567", "phone");
    const filed = await fileAll();
    expect(filed.filter((c) => c.status === "review")).toHaveLength(5);
    expect(filed.filter((c) => c.status === "hold")).toHaveLength(1);

    const zenith = filed.find((c) => c.company === "Zenith Bank")!;
    await expect(repo.ops.approve(zenith.id)).rejects.toThrow(/staff/);

    mockSignInAs("ops@vendii.ng", "email");
    await repo.ops.approve(zenith.id);
    await repo.ops.recordReceipt(zenith.id, "VR/DIV/1");
    await expect(repo.ops.debitFee(zenith.id)).rejects.toThrow();
    // The approver can't take the fee. Finance does.
    mockSignInAs("finance@vendii.ng", "email");
    await repo.ops.recordCollection(zenith.id);
    const paid = await repo.ops.debitFee(zenith.id);

    expect(paid.status).toBe("paid");
    expect(paid.ref).toBe("VR/DIV/1");
    expect(paid.events.some((e) => e.state === "wait" || e.state === "now")).toBe(false);
    expect(paid.events.at(-1)?.note).toContain("48,625");
  });

  it("routes an exception back to the shareholder and resumes chasing after the fix", async () => {
    mockSignInAs("+2348031234567", "phone");
    const uba = (await fileAll()).find((c) => c.company === "United Bank for Africa")!;
    mockSignInAs("ops@vendii.ng", "email");
    await repo.ops.approve(uba.id);
    await repo.ops.recordReceipt(uba.id, "AP/1");
    const ex = await repo.ops.raiseException(uba.id, "Name mismatch");
    expect(ex.status).toBe("exception");

    mockSignInAs("+2348031234567", "phone");
    const fixed = await repo.resolveException(uba.id);
    expect(fixed.status).toBe("chasing");
    expect(fixed.exceptionReason).toBeNull();
  });

  it("does not file the same holding twice, and keeps claims private", async () => {
    mockSignInAs("+2348031234567", "phone");
    await fileAll();
    expect(await fileAll()).toHaveLength(0);
    mockSignInAs("+2348099999999", "phone");
    expect(await repo.listMyClaims()).toHaveLength(0);
  });

  it("logs a shareholder check-in once and clears it when ops chases", async () => {
    mockSignInAs("+2348031234567", "phone");
    const c = (await fileAll()).find((x) => x.company === "Dangote Cement")!;
    mockSignInAs("ops@vendii.ng", "email");
    await repo.ops.approve(c.id);
    mockSignInAs("+2348031234567", "phone");
    await repo.requestChase(c.id);
    const twice = await repo.requestChase(c.id);
    expect(twice.chaseRequested).toBe(true);
    expect(twice.events.filter((e) => e.title === "You requested a status check")).toHaveLength(1);
    mockSignInAs("ops@vendii.ng", "email");
    const chased = await repo.ops.sendChase(c.id, { to: "x@y.com", subject: "s", body: "b" });
    expect(chased.chaseRequested).toBe(false);
  });
});
