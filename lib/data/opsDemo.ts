import { DEMO_STAFF } from "@/lib/auth/mockStaff";
import { applyAction, fileWithClock, type ClaimAction } from "@/lib/domain/actions";
import { claimAudit } from "@/lib/domain/audit";
import { DEFAULT_SLA } from "@/lib/domain/sla";
import type { Actor, AuditEntry, Claim, Filing } from "@/lib/domain/types";
import { DIRECTORY } from "@/lib/forms/registry";

/**
 * Admin-portal demo data: claims across many registrars in every state the portal cares about.
 * Each one is driven through the real actions with back-dated clocks, so the SLA dates, fee
 * records, approvers and audit trail are exactly what production would produce.
 */
const actor = (id: string): Actor => { const m = DEMO_STAFF.find((s) => s.id === id)!; return { id: m.id, name: m.name, role: m.role }; };
const REV = actor("mock-staff-reviewer"), AGENT = actor("mock-staff-agent"), FIN = actor("mock-staff-finance");

const company = (registrarId: string, i = 0) => {
  const list = DIRECTORY.filter((d) => d.registrarId === registrarId);
  return list[i % list.length];
};

type Step = [ClaimAction, Actor, number]; // action, who, days ago

interface Spec { owner: string; reg: string; ci?: number; amount: number; filedAgo: number; steps?: Step[]; assignee?: Actor }

const chase: ClaimAction = { type: "sendChase", message: { to: "registrar@example.com", subject: "Status", body: "Please update." } };

const SPECS: Spec[] = [
  // Waiting for review, one well past its 2-day SLA
  { owner: "Folake Adebayo", reg: "coronation", ci: 11, amount: 214000, filedAgo: 1 },
  { owner: "Ibrahim Musa", reg: "first", ci: 12, amount: 96500, filedAgo: 6, assignee: REV },
  { owner: "Grace Okonkwo", reg: "meristem", ci: 4, amount: 1380000, filedAgo: 3 },
  // Filed, waiting for the registrar to acknowledge
  { owner: "Emeka Nwosu", reg: "veritas", ci: 4, amount: 486250, filedAgo: 4, steps: [[{ type: "approve" }, REV, 3]], assignee: AGENT },
  { owner: "Halima Bello", reg: "cardinalstone", ci: 27, amount: 1432000, filedAgo: 15, steps: [[{ type: "approve" }, REV, 14]], assignee: AGENT },
  { owner: "Tunde Bakare", reg: "africaprudential", ci: 43, amount: 214400, filedAgo: 9, steps: [[{ type: "approve" }, REV, 8]] },
  // Chasing: one fresh, two overdue, one long enough to escalate
  { owner: "Chiamaka Eze", reg: "datamax", ci: 1, amount: 91800, filedAgo: 20, steps: [[{ type: "approve" }, REV, 19], [{ type: "recordReceipt", ref: "DMX/UD/26-1102" }, AGENT, 15], [chase, AGENT, 2]], assignee: AGENT },
  { owner: "Kunle Afolabi", reg: "coronation", ci: 4, amount: 327000, filedAgo: 30, steps: [[{ type: "approve" }, REV, 29], [{ type: "recordReceipt", ref: "CR/UD/26-0871" }, AGENT, 25]], assignee: AGENT },
  { owner: "Ngozi Umeh", reg: "first", ci: 12, amount: 58900, filedAgo: 40, steps: [[{ type: "approve" }, REV, 39], [{ type: "recordReceipt", ref: "FR/26/4471" }, AGENT, 34], [chase, AGENT, 18]] },
  { owner: "Bola Ajayi", reg: "greenwich", ci: 12, amount: 742000, filedAgo: 52, steps: [[{ type: "approve" }, REV, 51], [{ type: "recordReceipt", ref: "GTL/0926/118" }, AGENT, 47], [chase, AGENT, 25]], assignee: REV },
  // Waiting on the shareholder
  { owner: "Sola Ogunleye", reg: "pace", ci: 12, amount: 133500, filedAgo: 12, steps: [[{ type: "raiseException", reason: "Name on register is Olusola Ogunleye. Affidavit of name variation needed." }, REV, 10]] },
  // Registrar has paid: fee to request, in flight, failed and due for retry, failed and waiting
  { owner: "Yemi Alade", reg: "cardinalstone", ci: 30, amount: 890000, filedAgo: 35, steps: [[{ type: "approve" }, REV, 34], [{ type: "recordReceipt", ref: "CSR/UD/26-5520" }, AGENT, 30], [{ type: "recordCollection" }, FIN, 1]] },
  { owner: "Musa Danjuma", reg: "veritas", ci: 0, amount: 412000, filedAgo: 33, steps: [[{ type: "approve" }, REV, 32], [{ type: "recordReceipt", ref: "VR/26/2201" }, AGENT, 28], [{ type: "recordCollection" }, FIN, 3], [{ type: "requestDebit" }, FIN, 1]] },
  { owner: "Adaeze Obi", reg: "meristem", ci: 9, amount: 265000, filedAgo: 45, steps: [[{ type: "approve" }, REV, 44], [{ type: "recordReceipt", ref: "MRP/26/0091" }, AGENT, 40], [{ type: "recordCollection" }, FIN, 9], [{ type: "requestDebit" }, FIN, 8], [{ type: "failDebit", reason: "Insufficient funds" }, FIN, 7]] },
  { owner: "Femi Oyelaran", reg: "datamax", ci: 5, amount: 158000, filedAgo: 38, steps: [[{ type: "approve" }, REV, 37], [{ type: "recordReceipt", ref: "DMX/UD/26-0974" }, AGENT, 33], [{ type: "recordCollection" }, FIN, 3], [{ type: "requestDebit" }, FIN, 2], [{ type: "failDebit", reason: "Mandate not yet active at the bank" }, FIN, 1]] },
  // Closed: paid with the fee collected, a waiver, and two rejections with reasons
  { owner: "Ronke Williams", reg: "coronation", ci: 0, amount: 520000, filedAgo: 60, steps: [[{ type: "approve" }, REV, 59], [{ type: "recordReceipt", ref: "CR/UD/26-0302" }, AGENT, 55], [{ type: "recordCollection" }, FIN, 22], [{ type: "requestDebit" }, FIN, 21], [{ type: "debitFee" }, FIN, 20]] },
  { owner: "Uche Nnaji", reg: "coronation", ci: 25, amount: 175000, filedAgo: 70, steps: [[{ type: "approve" }, REV, 69], [{ type: "recordReceipt", ref: "CR/UD/26-0199" }, AGENT, 64], [{ type: "recordCollection" }, FIN, 40], [{ type: "requestDebit" }, FIN, 39], [{ type: "debitFee" }, FIN, 38]] },
  { owner: "Aisha Lawal", reg: "first", ci: 13, amount: 310000, filedAgo: 66, steps: [[{ type: "approve" }, REV, 65], [{ type: "recordReceipt", ref: "FR/26/3018" }, AGENT, 60], [{ type: "recordCollection" }, FIN, 25], [{ type: "requestDebit" }, FIN, 24], [{ type: "debitFee" }, FIN, 23]] },
  { owner: "Gbenga Olatunji", reg: "cardinalstone", ci: 14, amount: 64000, filedAgo: 58, steps: [[{ type: "approve" }, REV, 57], [{ type: "recordReceipt", ref: "CSR/UD/26-3310" }, AGENT, 52], [{ type: "recordCollection" }, FIN, 15], [{ type: "waiveFee", reason: "Estate in hardship; agreed with the family" }, actor("mock-staff-admin"), 14]] },
  { owner: "Patience Ekpo", reg: "first", ci: 20, amount: 88000, filedAgo: 50, steps: [[{ type: "approve" }, REV, 49], [{ type: "reject", reason: "Shares transferred out in 2019; dividend paid to the new holder." }, REV, 30]] },
  { owner: "Segun Coker", reg: "greenwich", ci: 30, amount: 47000, filedAgo: 48, steps: [[{ type: "approve" }, REV, 47], [{ type: "reject", reason: "Register name doesn't match the BVN record." }, REV, 28]] },
  { owner: "Tobi Fashola", reg: "coronation", ci: 3, amount: 125000, filedAgo: 44, steps: [[{ type: "approve" }, REV, 43], [{ type: "reject", reason: "Register name doesn't match the BVN record." }, REV, 26]] },
];

// Whole days back, plus a spread of working-hours minutes so the audit log doesn't read as one instant.
let tick = 0;
const ago = (now: Date, days: number) => new Date(now.getTime() - days * 864e5 - ((tick++ * 47) % 420) * 60_000);

export function buildOpsDemo(now = new Date()): { claims: Claim[]; filings: (Filing & { ownerId: string })[]; audit: AuditEntry[] } {
  tick = 0;
  const claims: Claim[] = [], filings: (Filing & { ownerId: string })[] = [], audit: AuditEntry[] = [];
  SPECS.forEach((s, n) => {
    const co = company(s.reg, s.ci);
    const id = `demo-${String(n + 1).padStart(2, "0")}-${s.reg}`;
    const ownerId = `demo-owner-${n + 1}`;
    const [first, ...rest] = s.owner.split(" ");
    const base: Claim = {
      id, ownerId, ownerName: s.owner, filingId: `demo-filing-${n + 1}`, registerEntryId: null,
      company: co.company, ticker: "", registrar: co.registrar, units: Math.round(s.amount / 9), years: "FY2021 \u2013 FY2024",
      amount: s.amount, pocket: "registrar", confidence: n % 4 === 2 ? "medium" : "high", matchedOn: s.owner, matchNote: "Exact match on the full registered name.",
      status: "draft", ref: null, submittedOn: null, paidOn: null, chaseRequested: false, events: [],
    };
    let c = fileWithClock(base, { now: ago(now, s.filedAgo), sla: DEFAULT_SLA });
    for (const [a, who, d] of s.steps ?? []) {
      const before = c;
      c = applyAction(c, a, { actor: who, now: ago(now, d), sla: DEFAULT_SLA });
      audit.push(claimAudit(a, before, c, who, ago(now, d)));
    }
    if (s.assignee) c = { ...c, assigneeId: s.assignee.id, assigneeName: s.assignee.name };
    claims.push(c);
    filings.push({
      id: base.filingId!, ownerId, flowType: "own", name: { first, middle: "", last: rest.join(" ") }, variants: [],
      bvn: "221" + String(54874700 + n).padStart(8, "0"), nin: null, chn: null, address: "12 Admiralty Way, Lekki",
      contact: { city: "Lekki", state: "Lagos", previousAddress: "", phone: "0803 555 01" + String(n).padStart(2, "0"), email: "" },
      bankName: "Guaranty Trust Bank", accountNumber: "01234" + String(56000 + n).padStart(5, "0"),
      photoUrl: null, signatureUrl: null, administrator: null, createdAt: ago(now, s.filedAgo).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    });
  });
  audit.sort((a, b) => b.at.localeCompare(a.at));
  return { claims, filings, audit };
}
