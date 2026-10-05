import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { COL, claimFromData, claimToData, pocketFor, type FilingDoc, type FilingPayload, type RegisterEntryDoc } from "@/lib/data/firestoreShape";
import { fileOne } from "@/lib/domain/actions";
import { isClosed } from "@/lib/domain/claimStatus";
import { fullName, normalizeName } from "@/lib/domain/names";
import type { Claim } from "@/lib/domain/types";
import { bankErrors, hasErrors, identityErrors } from "@/lib/domain/validation";
import { HttpError, body, caller, handle } from "@/lib/server/http";
import { today } from "@/lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Uploaded files must sit under the caller's own folder, or someone could attach another person's passport photo. */
function ownPath(path: unknown, folder: string, uid: string, required: boolean): string | null {
  if (path == null || path === "") {
    if (required) throw new HttpError(400, "A required document is missing. Go back and add it.");
    return null;
  }
  if (typeof path !== "string" || !path.startsWith(`${folder}/${uid}/`) || path.includes("..")) {
    throw new HttpError(400, "An uploaded file doesn't belong to this account.");
  }
  return path;
}

export const POST = handle(async (req) => {
  const { uid } = await caller(req);
  const p = await body<FilingPayload>(req);

  const flowType = p.flowType === "estate" ? "estate" : "own";
  const name = { first: str(p.name?.first, 80), middle: str(p.name?.middle, 80), last: str(p.name?.last, 80) };
  if (!name.first || !name.last) throw new HttpError(400, "A first name and surname are required.");
  const variants = (Array.isArray(p.variants) ? p.variants : []).map((v) => str(v, 120)).filter(Boolean).slice(0, 11);
  const f = { flowType, bvn: str(p.bvn, 11), nin: str(p.nin, 11), chn: str(p.chn, 40), address: str(p.address, 300), bankName: str(p.bankName, 80), accountNumber: str(p.accountNumber, 10) } as const;
  const errs = { ...identityErrors(f), ...bankErrors(f) };
  if (hasErrors(errs)) throw new HttpError(400, Object.values(errs)[0]!);

  if (!Array.isArray(p.poaAcks) || p.poaAcks.length !== 3 || !p.poaAcks.every((x) => x === true)) {
    throw new HttpError(400, "All three points of the authority must be acknowledged.");
  }
  if (!Array.isArray(p.mandateAcks) || p.mandateAcks.length !== 2 || !p.mandateAcks.every((x) => x === true)) {
    throw new HttpError(400, "Both mandate points must be acknowledged.");
  }

  const c = p.contact ?? ({} as FilingPayload["contact"]);
  const contact = { city: str(c.city, 80), state: str(c.state, 60), previousAddress: str(c.previousAddress, 300), phone: str(c.phone, 20), email: str(c.email, 120) };
  const photoPath = ownPath(p.photoPath, "identity-photos", uid, false);
  const signaturePath = ownPath(p.signaturePath, "signatures", uid, true)!;

  let administrator: FilingDoc["administrator"] = null;
  if (flowType === "estate") {
    const a = p.administrator;
    if (!a) throw new HttpError(400, "Estate claims need the administrator's details and Letters of Administration or Grant of Probate.");
    const aName = { first: str(a.name?.first, 80), middle: str(a.name?.middle, 80), last: str(a.name?.last, 80) };
    if (!aName.first || !aName.last || !str(a.relationship) || !str(a.phone, 20)) {
      throw new HttpError(400, "Add the administrator's name, relationship and phone number.");
    }
    administrator = {
      name: aName, relationship: str(a.relationship, 60), phone: str(a.phone, 20),
      email: str(a.email, 120) || null, address: str(a.address, 300) || null,
      photoPath: ownPath(a.photoPath, "identity-photos", uid, false),
      probateDocName: str(a.probateDocName, 200) || "Probate document",
      probateDocPath: ownPath(a.probateDocPath, "estate-documents", uid, true)!,
    };
  }

  const entryIds = Array.from(new Set((Array.isArray(p.entryIds) ? p.entryIds : []).filter((x): x is string => typeof x === "string" && /^[\w-]{1,128}$/.test(x)))).slice(0, 100);
  if (!entryIds.length) throw new HttpError(400, "Choose at least one claim to file.");

  const db = adminDb();
  const entries = await db.getAll(...entryIds.map((id) => db.collection(COL.register).doc(id)));
  const spellings = [fullName(name), ...variants];
  const norms = new Set(spellings.map(normalizeName));

  const existing = await db.collection(COL.claims).where("ownerId", "==", uid).get();
  const openEntries = new Set(existing.docs.map((d) => claimFromData(d.id, d.data())).filter((c) => !isClosed(c.status)).map((c) => c.registerEntryId));

  const filingRef = db.collection(COL.filings).doc();
  const ownerName = fullName(name);
  const batch = db.batch();
  const filed: Claim[] = [];

  for (const snap of entries) {
    if (!snap.exists) throw new HttpError(400, "One of those register entries no longer exists. Search again.");
    const e = snap.data() as RegisterEntryDoc;
    // The entry has to match a name on this filing. Stops anyone filing on an entry ID they guessed.
    if (!norms.has(e.holderNameNorm)) throw new HttpError(400, `${e.company} doesn't match any name on this filing. Search again.`);
    if (openEntries.has(snap.id)) continue;

    const primaryNorm = normalizeName(ownerName);
    const exact = e.holderNameNorm === primaryNorm;
    const ref = db.collection(COL.claims).doc();
    const claim = fileOne({
      id: ref.id, registerEntryId: snap.id, filingId: filingRef.id, ownerId: uid, ownerName,
      company: e.company, ticker: e.ticker ?? "", registrar: e.registrar,
      units: Number(e.units), years: e.years, amount: Number(e.estimatedAmount), pocket: pocketFor(e.declaredOn),
      confidence: exact ? "high" : "medium",
      matchedOn: spellings.find((s) => normalizeName(s) === e.holderNameNorm) ?? ownerName,
      matchNote: exact ? "Exact match on the full registered name." : "Matched on a spelling you gave us. A person here confirms it before filing.",
      status: "draft", exceptionReason: null, ref: null, submittedOn: null, paidOn: null, chaseRequested: false, events: [],
    });
    batch.set(ref, { ...claimToData(claim), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    filed.push(claim);
  }

  const filing: FilingDoc & { createdAt: FieldValue } = {
    ownerId: uid, flowType, name, variants,
    bvn: f.bvn || null, nin: f.nin || null, chn: f.chn || null, address: f.address || null, contact,
    bankName: f.bankName, accountNumber: f.accountNumber, photoPath, administrator,
    poa: {
      signaturePath,
      acks: { scopeOnly: true, noCustody: true, freeAlternative: true },
      claimIds: filed.filter((c) => c.status === "review").map((c) => c.id),
      signedAtLabel: today(),
      revokedAt: null,
    },
    // Recorded as pending. Creating the real NIBSS mandate needs the provider's secret keys; see README.
    mandate: { bankName: f.bankName, accountNumber: f.accountNumber, acks: { variable: true, noticeBeforeDebit: true }, status: "pending", provider: null },
    createdLabel: today(),
    createdAt: FieldValue.serverTimestamp(),
  };
  batch.set(filingRef, filing);
  await batch.commit();
  return filed;
});
