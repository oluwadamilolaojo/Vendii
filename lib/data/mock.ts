import "@/lib/storageMigration";
import { readMockSession } from "@/lib/auth/mock";
import { readMockStaff, setMockRole } from "@/lib/auth/mockStaff";
import { applyAction, fileWithClock, type ClaimAction, type OpsAction } from "@/lib/domain/actions";
import { auditEntry, claimAudit } from "@/lib/domain/audit";
import { PermissionError, authorizeAction, requirePermission } from "@/lib/domain/authorize";
import { isClosed } from "@/lib/domain/claimStatus";
import { fullName } from "@/lib/domain/names";
import { can, isStaff, type Permission } from "@/lib/domain/permissions";
import { withDefaults } from "@/lib/domain/registrarDesk";
import { mergeSettings, validateSettings } from "@/lib/domain/settings";
import { buildForms } from "@/lib/forms/client";
import { holdingsFromClaims, profileFromFiling } from "@/lib/forms/profile";
import type { Actor, AuditEntry, Claim, Filing, RegistrarProfile, Session, Settings } from "@/lib/domain/types";
import { delay, today, uid } from "@/lib/util";
import { buildOpsDemo } from "./opsDemo";
import type { BulkResult, Repository } from "./repository";
import { buildCandidates, buildSampleHistory } from "./seed";

const KEY = "vendii:v1:db";

interface MockDb {
  claims: Claim[];
  filings: (Filing & { ownerId: string })[];
  audit: AuditEntry[];
  registrars: RegistrarProfile[];
  settings: Settings | null;
}

const empty = (): MockDb => ({ claims: [], filings: [], audit: [], registrars: [], settings: null });

function read(): MockDb {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...empty(), ...(JSON.parse(raw) as Partial<MockDb>) };
  } catch {
    /* corrupt storage: start over */
  }
  return empty();
}

function write(db: MockDb): void {
  db.audit = db.audit.slice(0, 2000); // the browser isn't an archive
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

const actorOf = (s: Session): Actor => ({ id: s.userId, name: s.name ?? s.identifier, role: s.role });

function staffActor(p: Permission): Actor {
  const a = actorOf(session());
  requirePermission(a, p);
  return a;
}

/** Same rules as the Firebase route: authorise, apply on the clock, write the audit line. */
function runAction(db: MockDb, id: string, action: ClaimAction, actor: Actor, bulk = false): Claim {
  const i = db.claims.findIndex((c) => c.id === id);
  if (i < 0) throw new Error("That claim doesn't exist.");
  const before = db.claims[i];
  authorizeAction(actor, before, action);
  const now = new Date();
  const after = applyAction(before, action, { actor, now, sla: mergeSettings(db.settings).sla, bulk });
  db.claims[i] = after;
  db.audit.unshift(claimAudit(action, before, after, actor, now));
  return after;
}

async function act(id: string, action: ClaimAction): Promise<Claim> {
  await delay(200);
  const db = read();
  const out = runAction(db, id, action, actorOf(session()));
  write(db);
  return out;
}

export const mockRepository: Repository & {
  resetDemo(): void;
  loadSampleHistory(): void;
  loadOpsDemo(): void;
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
      filed.push(fileWithClock({
        ...cand, id: uid(), filingId, ownerId: s.userId, ownerName, status: "draft", events: [],
        ref: null, submittedOn: null, paidOn: null, chaseRequested: false, exceptionReason: null,
      }));
    }
    db.claims.push(...filed);
    const who = actorOf(s);
    for (const c of filed) db.audit.unshift(auditEntry(who, "claim.file", `Filed ${c.company} with ${c.registrar}`, { claimId: c.id, filingId }));
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
    if (c && c.ownerId !== s.userId && !isStaff(s.role)) return null;
    return c;
  },

  requestChase: (id) => act(id, { type: "requestChase" }),
  resolveException: (id) => act(id, { type: "resolveException" }),

  async uploadFile(kind, file) {
    await delay(200);
    return `mock://${kind}/${file.name}`;
  },

  ops: {
    async listAll() {
      staffActor("queue.view");
      return read().claims;
    },
    async getFiling(filingId) {
      const a = staffActor("filings.view");
      const db = read();
      const f = db.filings.find((x) => x.id === filingId) ?? null;
      if (f) {
        db.audit.unshift(auditEntry(a, "filing.view", `Viewed ID documents for ${fullName(f.name)}`, { filingId }));
        write(db);
      }
      return f;
    },
    act: (id, action) => act(id, action),
    async bulk(ids, action: OpsAction): Promise<BulkResult> {
      await delay(250);
      const db = read();
      const actor = actorOf(session());
      const out: BulkResult = { done: [], failed: [] };
      for (const id of ids) {
        try { out.done.push(runAction(db, id, action, actor, true)); }
        catch (e) { out.failed.push({ id, error: e instanceof Error ? e.message : "Failed" }); }
      }
      write(db);
      return out;
    },
    approve: (id) => act(id, { type: "approve" }),
    recordReceipt: (id, ref) => act(id, { type: "recordReceipt", ref }),
    sendChase: (id, message) => act(id, { type: "sendChase", message }),
    recordCollection: (id) => act(id, { type: "recordCollection" }),
    debitFee: (id) => act(id, { type: "debitFee" }),
    reject: (id, reason) => act(id, { type: "reject", reason }),
    raiseException: (id, reason) => act(id, { type: "raiseException", reason }),
    async downloadForms(filingId) {
      const a = staffActor("filings.view");
      const db = read();
      const filing = db.filings.find((f) => f.id === filingId);
      if (!filing) throw new Error("That filing doesn't exist.");
      const { holdings, unmapped } = holdingsFromClaims(db.claims.filter((c) => c.filingId === filingId));
      if (!holdings.length) throw new Error("No claim on this filing goes to a registrar with a mapped form.");
      const photo = filing.administrator?.photoUrl ?? filing.photoUrl;
      const result = await buildForms({ profile: profileFromFiling(filing), holdings, photo: photo?.startsWith("data:") ? photo : null, signature: filing.signatureUrl?.startsWith("data:") ? filing.signatureUrl : null });
      if (result.report) result.report.unmapped = unmapped.map((c) => `${c.company} (${c.registrar})`);
      db.audit.unshift(auditEntry(a, "forms.generate", `Generated registrar forms for ${fullName(filing.name)}`, { filingId }));
      write(db);
      return result;
    },
    async staff() {
      staffActor("queue.view");
      return readMockStaff().filter((m) => m.active);
    },
    async registrars() {
      staffActor("queue.view");
      return withDefaults(read().registrars);
    },
    async saveRegistrar(p) {
      const a = staffActor("registrars.edit");
      const db = read();
      const saved: RegistrarProfile = { ...p, updatedAt: new Date().toISOString(), updatedBy: a.name };
      db.registrars = [...db.registrars.filter((r) => r.id !== p.id), saved];
      db.audit.unshift(auditEntry(a, "registrar.update", `Updated ${p.name}: contacts, requirements or notes`, { registrarId: p.id }));
      write(db);
      return saved;
    },
    async settings() {
      staffActor("queue.view");
      return mergeSettings(read().settings);
    },
    async saveSettings(input) {
      const a = staffActor("settings.edit");
      const next = validateSettings(input);
      const db = read();
      db.settings = next;
      db.audit.unshift(auditEntry(a, "settings.update", `Changed SLA policy: ${Object.entries(next.sla).map(([k, v]) => `${k} ${v}`).join(", ")}`));
      write(db);
      return next;
    },
    async audit() {
      staffActor("audit.view");
      return read().audit;
    },
    async setRole({ identifier, name, role }) {
      const a = staffActor("team.manage");
      const target = identifier.trim();
      if (!target) throw new Error("Enter the email or phone number they sign in with.");
      const me = session();
      if (target.toLowerCase() === me.identifier.toLowerCase()) throw new PermissionError("You can't change your own role. Ask another admin.");
      const m = setMockRole(target, name, role);
      const db = read();
      db.audit.unshift(auditEntry(a, "team.setRole", role ? `Gave ${m?.name ?? target} the ${role} role` : `Removed staff access for ${m?.name ?? target}`));
      write(db);
      return m;
    },
  },

  resetDemo() {
    window.localStorage.removeItem(KEY);
  },

  /** Claims across many registrars in every state, for trying the admin portal. Replaces earlier demo claims. */
  loadOpsDemo() {
    const db = read();
    const demo = buildOpsDemo();
    db.claims = db.claims.filter((c) => !c.id.startsWith("demo-")).concat(demo.claims);
    db.filings = db.filings.filter((f) => !f.id.startsWith("demo-")).concat(demo.filings);
    db.audit = demo.audit.concat(db.audit.filter((e) => !e.claimId?.startsWith("demo-")));
    write(db);
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
