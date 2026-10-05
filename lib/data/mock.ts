import { readMockSession } from "@/lib/auth/mock";
import { applyAction, fileOne, type ClaimAction } from "@/lib/domain/actions";
import { isClosed } from "@/lib/domain/claimStatus";
import { fullName } from "@/lib/domain/names";
import { buildForms } from "@/lib/forms/client";
import { holdingsFromClaims, profileFromFiling } from "@/lib/forms/profile";
import type { Claim, Filing, Session } from "@/lib/domain/types";
import { delay, today, uid } from "@/lib/util";
import type { Repository } from "./repository";
import { buildCandidates, buildSampleHistory } from "./seed";

const KEY = "dividendi:v1:db";

interface MockDb {
  claims: Claim[];
  filings: (Filing & { ownerId: string })[];
}

function read(): MockDb {
  if (typeof window === "undefined") return { claims: [], filings: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as Partial<MockDb>;
      return { claims: db.claims ?? [], filings: db.filings ?? [] };
    }
  } catch {
    /* corrupt storage: start over */
  }
  return { claims: [], filings: [] };
}

function write(db: MockDb): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Photos and signatures are the heavy part; drop them rather than lose the claims.
    const lean = { ...db, filings: db.filings.map((f) => ({ ...f, photoUrl: null, signatureUrl: null })) };
    window.localStorage.setItem(KEY, JSON.stringify(lean));
  }
}

function session(): Session {
  const s = readMockSession();
  if (!s) throw new Error("Sign in to continue.");
  return s;
}

function requireOps(): Session {
  const s = session();
  if (s.role !== "ops") throw new Error("Only Dividendi staff can do that.");
  return s;
}

/** Same permission split as the Firebase routes: owner actions need the owner, everything else needs ops. */
async function act(id: string, action: ClaimAction, who: "owner" | "ops"): Promise<Claim> {
  await delay(250);
  const s = who === "ops" ? requireOps() : session();
  const db = read();
  const i = db.claims.findIndex((c) => c.id === id);
  if (i < 0) throw new Error("That claim doesn't exist.");
  if (who === "owner" && db.claims[i].ownerId !== s.userId) throw new Error("That claim isn't yours.");
  db.claims[i] = applyAction(db.claims[i], action);
  write(db);
  return db.claims[i];
}

export const mockRepository: Repository & {
  resetDemo(): void;
  loadSampleHistory(): void;
} = {
  async searchRegisters(input) {
    session();
    await delay(300);
    return buildCandidates(input);
  },

  async fileClaims(input) {
    const s = session();
    await delay(600);
    const db = read();
    const filingId = uid();
    const ownerName = fullName(input.name);
    db.filings.push({
      id: filingId,
      ownerId: s.userId,
      flowType: input.flowType,
      name: input.name,
      variants: input.variants,
      bvn: input.bvn || null,
      nin: input.nin || null,
      chn: input.chn || null,
      address: input.address || null,
      contact: input.contact ?? null,
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      photoUrl: input.photo,
      signatureUrl: input.signature,
      administrator: input.administrator && {
        name: input.administrator.name,
        relationship: input.administrator.relationship,
        phone: input.administrator.phone,
        email: input.administrator.email || null,
        address: input.administrator.address || null,
        photoUrl: input.administrator.photo,
        probateDoc: input.administrator.probateDocName,
      },
      createdAt: today(),
    });

    const filed: Claim[] = [];
    for (const cand of input.candidates) {
      if (cand.pocket !== "uftf" && !input.selectedIds.includes(cand.id)) continue;
      const duplicate = db.claims.some((c) => c.ownerId === s.userId && c.registerEntryId === cand.registerEntryId && !isClosed(c.status));
      if (duplicate) continue;
      filed.push(fileOne({
        ...cand, id: uid(), filingId, ownerId: s.userId, ownerName, status: "draft", events: [],
        ref: null, submittedOn: null, paidOn: null, chaseRequested: false, exceptionReason: null,
      }));
    }
    db.claims.push(...filed);
    write(db);
    return filed;
  },

  async listMyClaims() {
    const s = session();
    return read().claims.filter((c) => c.ownerId === s.userId);
  },

  async getClaim(id) {
    const s = session();
    const c = read().claims.find((x) => x.id === id) ?? null;
    if (c && c.ownerId !== s.userId && s.role !== "ops") return null;
    return c;
  },

  requestChase: (id) => act(id, { type: "requestChase" }, "owner"),
  resolveException: (id) => act(id, { type: "resolveException" }, "owner"),

  async uploadFile(kind, file) {
    await delay(200);
    return `mock://${kind}/${file.name}`;
  },

  ops: {
    async listAll() {
      requireOps();
      return read().claims;
    },
    async getFiling(filingId) {
      requireOps();
      return read().filings.find((f) => f.id === filingId) ?? null;
    },
    approve: (id) => act(id, { type: "approve" }, "ops"),
    recordReceipt: (id, ref) => act(id, { type: "recordReceipt", ref }, "ops"),
    sendChase: (id, message) => act(id, { type: "sendChase", message }, "ops"),
    recordCollection: (id) => act(id, { type: "recordCollection" }, "ops"),
    debitFee: (id) => act(id, { type: "debitFee" }, "ops"),
    reject: (id, reason) => act(id, { type: "reject", reason }, "ops"),
    raiseException: (id, reason) => act(id, { type: "raiseException", reason }, "ops"),
    async downloadForms(filingId) {
      requireOps();
      const db = read();
      const filing = db.filings.find((f) => f.id === filingId);
      if (!filing) throw new Error("That filing doesn't exist.");
      const { holdings, unmapped } = holdingsFromClaims(db.claims.filter((c) => c.filingId === filingId));
      if (!holdings.length) throw new Error("No claim on this filing goes to a registrar with a mapped form.");
      const photo = filing.administrator?.photoUrl ?? filing.photoUrl;
      const result = await buildForms({ profile: profileFromFiling(filing), holdings, photo: photo?.startsWith("data:") ? photo : null, signature: filing.signatureUrl?.startsWith("data:") ? filing.signatureUrl : null });
      if (result.report) result.report.unmapped = unmapped.map((c) => `${c.company} (${c.registrar})`);
      return result;
    },
  },

  resetDemo() {
    window.localStorage.removeItem(KEY);
  },

  loadSampleHistory() {
    const s = session();
    const db = read();
    db.claims = db.claims.filter((c) => c.ownerId !== s.userId).concat(buildSampleHistory(s.userId, "Adewale Bamidele Ogunyemi"));
    if (!db.filings.some((f) => f.id === "sample-filing")) {
      db.filings.push({
        id: "sample-filing", ownerId: s.userId, flowType: "own",
        name: { first: "Adewale", middle: "Bamidele", last: "Ogunyemi" },
        variants: ["A. B. Ogunyemi", "Adewale B. Ogunyemi", "Adewale Ogunyemi"],
        bvn: "22154874718", nin: "40218879034", chn: null, address: "14 Bourdillon Close, Ikoyi, Lagos",
        contact: { city: "Ikoyi", state: "Lagos", previousAddress: "", phone: "08031234567", email: "adewale@example.com" },
        bankName: "Guaranty Trust Bank", accountNumber: "0123456213",
        photoUrl: null, signatureUrl: null, administrator: null, createdAt: "10 Aug 2026",
      });
    }
    write(db);
  },
};
