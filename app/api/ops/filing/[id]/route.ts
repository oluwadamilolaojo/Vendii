import { adminBucket, adminDb } from "@/lib/firebase/admin";
import { COL, type FilingDoc } from "@/lib/data/firestoreShape";
import { auditEntry } from "@/lib/domain/audit";
import { fullName } from "@/lib/domain/names";
import type { Filing } from "@/lib/domain/types";
import { writeAudit } from "@/lib/server/audit";
import { HttpError, actorOf, caller, handle, requireStaff } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINK_MINUTES = 15;

async function signed(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try {
    const [url] = await adminBucket().file(path).getSignedUrl({ action: "read", expires: Date.now() + LINK_MINUTES * 60_000 });
    return url;
  } catch {
    return null;
  }
}

/**
 * A filing's identity documents, for staff with filings.view. Every call is logged, and photos,
 * signatures and probate documents come back as links that stop working after 15 minutes.
 */
export const POST = handle(async (req, { params }) => {
  const who = await caller(req);
  requireStaff(who, "filings.view");
  const db = adminDb();
  const snap = await db.collection(COL.filings).doc(params.id).get();
  if (!snap.exists) throw new HttpError(404, "That filing doesn't exist.");
  const r = snap.data() as FilingDoc;
  await writeAudit(db, auditEntry(actorOf(who), "filing.view", `Viewed ID documents for ${fullName(r.name)}`, { filingId: snap.id }));
  const a = r.administrator;
  const filing: Filing = {
    id: snap.id, flowType: r.flowType, name: r.name, variants: r.variants ?? [],
    bvn: r.bvn, nin: r.nin, chn: r.chn, address: r.address, contact: r.contact ?? null,
    bankName: r.bankName, accountNumber: r.accountNumber,
    photoUrl: await signed(r.photoPath), signatureUrl: await signed(r.poa?.signaturePath),
    administrator: a ? {
      name: a.name, relationship: a.relationship, phone: a.phone, email: a.email, address: a.address,
      photoUrl: await signed(a.photoPath), probateDoc: (await signed(a.probateDocPath)) ?? a.probateDocName,
    } : null,
    createdAt: r.createdLabel,
  };
  return filing;
});
