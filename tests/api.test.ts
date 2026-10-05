/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./support/fakeFirestore";
import { normalizeName } from "@/lib/domain/names";

let db = new FakeDb();
const TOKENS: Record<string, { uid: string; role?: string }> = {
  "t-ade": { uid: "ade" },
  "t-eve": { uid: "eve" },
  "t-ops": { uid: "staff", role: "ops" },
};

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => db,
  adminAuth: () => ({
    verifyIdToken: async (t: string) => {
      if (!TOKENS[t]) throw Object.assign(new Error("bad token"), { code: "auth/argument-error" });
      return TOKENS[t];
    },
  }),
}));

const { POST: search } = await import("@/app/api/search/route");
const { POST: file } = await import("@/app/api/claims/file/route");
const { POST: act } = await import("@/app/api/claims/[id]/route");

async function call(handler: any, token: string | null, payload: unknown, params: Record<string, string> = {}) {
  const res = await handler(new Request("http://test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  }), { params });
  return { status: res.status as number, body: await res.json() };
}

const name = { first: "Adewale", middle: "Bamidele", last: "Ogunyemi" };
const variants = ["A. B. Ogunyemi", "Adewale Ogunyemi"];

function seed() {
  const put = (id: string, holderName: string, company: string, amount: number, declaredOn: string) =>
    db.table("registerEntries").set(id, {
      company, ticker: company.slice(0, 4).toUpperCase(), registrar: "Veritas Registrars", holderName,
      holderNameNorm: normalizeName(holderName), units: 100, years: "FY2023", estimatedAmount: amount, declaredOn, source: "test",
    });
  put("zen", "Adewale Bamidele Ogunyemi", "Zenith Bank", 486250, "2023-04-15");
  put("uba", "A.B. Ogunyemi", "United Bank for Africa", 214400, "2024-05-01");
  put("cad", "Adewale Ogunyemi", "Cadbury Nigeria", 58900, "2016-06-01");
  put("other", "Chiamaka Eze", "MTN Nigeria", 900000, "2024-01-01");
}

function filing(uid: string, entryIds: string[], extra: Record<string, unknown> = {}) {
  return {
    flowType: "own", name, variants, bvn: "22154874718", nin: "", chn: "", address: "14 Bourdillon Close, Ikoyi",
    photoPath: `identity-photos/${uid}/1-shareholder.jpg`, administrator: null,
    bankName: "Guaranty Trust Bank", accountNumber: "0123456213", entryIds,
    signaturePath: `signatures/${uid}/1-authority.png`, poaAcks: [true, true, true], mandateAcks: [true, true], ...extra,
  };
}

describe("Firebase API routes", () => {
  beforeEach(() => {
    db = new FakeDb();
    seed();
  });

  it("refuses calls without a valid token", async () => {
    expect((await call(search, null, { name, variants })).status).toBe(401);
    expect((await call(search, "forged", { name, variants })).status).toBe(401);
  });

  it("finds entries by any spelling and never returns someone else's", async () => {
    const r = await call(search, "t-ade", { name, variants });
    expect(r.status).toBe(200);
    const byId = Object.fromEntries(r.body.map((c: any) => [c.registerEntryId, c]));
    expect(Object.keys(byId).sort()).toEqual(["cad", "uba", "zen"]);
    expect(byId.zen.confidence).toBe("high");
    expect(byId.uba.confidence).toBe("medium");
    expect(byId.uba.matchedOn).toBe("A. B. Ogunyemi");
    expect(byId.cad.pocket).toBe("uftf");
  });

  it("files from the register, not the request, and runs the full lifecycle", async () => {
    const r = await call(file, "t-ade", { ...filing("ade", ["zen", "uba", "cad"]), amount: 1, company: "Fake" });
    expect(r.status).toBe(200);
    expect(r.body.map((c: any) => c.status).sort()).toEqual(["hold", "review", "review"]);
    const zen = r.body.find((c: any) => c.registerEntryId === "zen");
    expect(zen.amount).toBe(486250);
    expect(db.all("filings")).toHaveLength(1);
    expect(db.all("filings")[0].mandate.status).toBe("pending");

    // A shareholder can't approve their own claim.
    expect((await call(act, "t-ade", { type: "approve" }, { id: zen.id })).status).toBe(403);

    expect((await call(act, "t-ops", { type: "approve" }, { id: zen.id })).body.status).toBe("submitted");
    expect((await call(act, "t-ops", { type: "recordReceipt", ref: " " }, { id: zen.id })).status).toBe(400);
    expect((await call(act, "t-ops", { type: "recordReceipt", ref: "VR/1" }, { id: zen.id })).body.status).toBe("chasing");

    // Fee before the registrar has paid: refused by the state machine.
    const early = await call(act, "t-ops", { type: "debitFee" }, { id: zen.id });
    expect(early.status).toBe(400);
    expect(db.all("feeDebits")).toHaveLength(0);

    await call(act, "t-ops", { type: "recordCollection" }, { id: zen.id });
    const paid = await call(act, "t-ops", { type: "debitFee" }, { id: zen.id });
    expect(paid.body.status).toBe("paid");
    expect(db.all("feeDebits")).toEqual([expect.objectContaining({ id: zen.id, fee: 48625, net: 437625 })]);

    // A second debit is impossible.
    expect((await call(act, "t-ops", { type: "debitFee" }, { id: zen.id })).status).toBeGreaterThanOrEqual(400);
    expect(db.all("feeDebits")).toHaveLength(1);
  });

  it("won't file an entry that doesn't match the names on the filing", async () => {
    const r = await call(file, "t-ade", filing("ade", ["zen", "other"]));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/MTN Nigeria/);
    expect(db.all("claims")).toHaveLength(0);
  });

  it("won't attach files from another user's folder", async () => {
    const r = await call(file, "t-eve", filing("eve", ["zen"], { photoPath: "identity-photos/ade/1-shareholder.jpg" }));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/doesn't belong/);
  });

  it("requires every acknowledgement and valid bank details", async () => {
    expect((await call(file, "t-ade", filing("ade", ["zen"], { poaAcks: [true, false, true] }))).status).toBe(400);
    expect((await call(file, "t-ade", filing("ade", ["zen"], { accountNumber: "123" }))).status).toBe(400);
  });

  it("doesn't file the same holding twice while a claim is open", async () => {
    await call(file, "t-ade", filing("ade", ["zen"]));
    const again = await call(file, "t-ade", filing("ade", ["zen"]));
    expect(again.body).toEqual([]);
    expect(db.all("claims")).toHaveLength(1);
  });

  it("keeps owner actions to the owner and logs chase messages for sending", async () => {
    const [zen] = (await call(file, "t-ade", filing("ade", ["zen"]))).body;
    await call(act, "t-ops", { type: "approve" }, { id: zen.id });

    expect((await call(act, "t-eve", { type: "requestChase" }, { id: zen.id })).status).toBe(403);
    expect((await call(act, "t-ade", { type: "requestChase" }, { id: zen.id })).body.chaseRequested).toBe(true);

    const sent = await call(act, "t-ops", { type: "sendChase", message: { to: "info@veritas.ng", subject: "Status", body: "Hello" } }, { id: zen.id });
    expect(sent.body.chaseRequested).toBe(false);
    expect(db.all("outboundMessages")).toEqual([expect.objectContaining({ status: "queued", to: "info@veritas.ng" })]);
  });

  it("rejects unknown actions and needs a reason to close a claim", async () => {
    const [zen] = (await call(file, "t-ade", filing("ade", ["zen"]))).body;
    expect((await call(act, "t-ops", { type: "markPaid" }, { id: zen.id })).status).toBe(400);
    expect((await call(act, "t-ops", { type: "reject", reason: "" }, { id: zen.id })).status).toBe(400);
    expect((await call(act, "t-ops", { type: "reject", reason: "Transferred out in 2019." }, { id: zen.id })).body.status).toBe("rejected");
  });
});
