import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { COL, claimFromData, claimToData, type ActionPayload } from "@/lib/data/firestoreShape";
import { OWNER_ACTIONS, applyAction } from "@/lib/domain/actions";
import { FEE_RATE, feeFor, netFor } from "@/lib/domain/fees";
import { HttpError, body, caller, handle, requireOps } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN = new Set(["requestChase", "resolveException", "approve", "recordReceipt", "sendChase", "recordCollection", "debitFee", "reject", "raiseException"]);

/**
 * Every change to a claim after filing. Runs inside a transaction so two staff
 * clicking at once can't both move the same claim.
 */
export const POST = handle(async (req, { params }) => {
  const who = await caller(req);
  const action = await body<ActionPayload>(req);
  if (!action || !KNOWN.has(action.type)) throw new HttpError(400, "Unknown action.");
  const ownerAction = OWNER_ACTIONS.includes(action.type);
  if (!ownerAction) requireOps(who);

  const db = adminDb();
  const ref = db.collection(COL.claims).doc(params.id);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "That claim doesn't exist.");
    const before = claimFromData(snap.id, snap.data());
    if (ownerAction && before.ownerId !== who.uid) throw new HttpError(403, "That claim isn't yours.");

    const feeRef = db.collection(COL.feeDebits).doc(before.id);
    if (action.type === "debitFee") {
      // Reads before writes in a Firestore transaction. One debit per claim, ever.
      if ((await tx.get(feeRef)).exists) throw new HttpError(409, "The fee on this claim has already been debited.");
    }

    const after = applyAction(before, action);
    tx.update(ref, { ...claimToData(after), updatedAt: FieldValue.serverTimestamp() });

    if (action.type === "debitFee") {
      tx.create(feeRef, {
        claimId: before.id, ownerId: before.ownerId, filingId: before.filingId,
        gross: before.amount, rate: FEE_RATE, fee: feeFor(before.amount), net: netFor(before.amount),
        // Recorded by staff for now. The mandate provider's webhook replaces this; see README.
        status: "recorded", provider: null, recordedBy: who.uid, createdAt: FieldValue.serverTimestamp(),
      });
    }
    if (action.type === "sendChase") {
      tx.create(db.collection(COL.outbound).doc(), {
        claimId: before.id, to: String(action.message.to).slice(0, 200), subject: String(action.message.subject ?? "").slice(0, 300),
        body: String(action.message.body ?? "").slice(0, 10000), status: "queued", queuedBy: who.uid, createdAt: FieldValue.serverTimestamp(),
      });
    }
    return after;
  });
});
