import "server-only";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { COL, SETTINGS_DOC, claimFromData, claimToData } from "@/lib/data/firestoreShape";
import { applyAction, type ClaimAction } from "@/lib/domain/actions";
import { claimAudit } from "@/lib/domain/audit";
import { authorizeAction } from "@/lib/domain/authorize";
import { mergeSettings } from "@/lib/domain/settings";
import type { Claim, Settings } from "@/lib/domain/types";
import { HttpError, actorOf, type Caller } from "./http";

export const KNOWN_ACTIONS = new Set<ClaimAction["type"]>([
  "requestChase", "resolveException", "approve", "recordReceipt", "sendChase", "recordCollection",
  "requestDebit", "failDebit", "debitFee", "waiveFee", "reject", "raiseException", "assign",
]);

const MONEY = new Set<ClaimAction["type"]>(["recordCollection", "requestDebit", "failDebit", "debitFee", "waiveFee"]);

export async function loadSettings(db: Firestore): Promise<Settings> {
  const snap = await db.collection(COL.config).doc(SETTINGS_DOC).get();
  return mergeSettings(snap.exists ? (snap.data() as Settings) : null);
}

/** Basic shape checks on what the browser sent. The domain functions enforce the rules. */
export function parseAction(raw: unknown): ClaimAction {
  const a = raw as ClaimAction | null;
  if (!a || typeof a !== "object" || !KNOWN_ACTIONS.has(a.type)) throw new HttpError(400, "Unknown action.");
  if (a.type === "assign" && a.assignee !== null && (typeof a.assignee?.id !== "string" || typeof a.assignee?.name !== "string")) {
    throw new HttpError(400, "Say who to assign it to.");
  }
  return a;
}

/**
 * Every change to a claim after filing. One transaction: read, authorise, apply, write the claim,
 * write the audit line, mirror the fee ledger. Two staff clicking at once can't both move it.
 */
export async function runClaimAction(db: Firestore, who: Caller, id: string, action: ClaimAction, settings: Settings, bulk = false): Promise<Claim> {
  const ref = db.collection(COL.claims).doc(id);
  const actor = actorOf(who);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "That claim doesn't exist.");
    const before = claimFromData(snap.id, snap.data());
    authorizeAction(actor, before, action);
    const now = new Date();
    const after = applyAction(before, action, { actor, now, sla: settings.sla, bulk });
    const entry = claimAudit(action, before, after, actor, now);

    tx.update(ref, { ...claimToData(after), updatedAt: FieldValue.serverTimestamp() });
    tx.create(db.collection(COL.audit).doc(entry.id), entry);

    if (MONEY.has(action.type) && after.fee) {
      tx.set(db.collection(COL.feeDebits).doc(before.id), {
        claimId: before.id, ownerId: before.ownerId, filingId: before.filingId ?? null,
        company: before.company, registrar: before.registrar, gross: before.amount, ...after.fee,
        history: FieldValue.arrayUnion({ at: now.toISOString(), action: action.type, by: actor.id, status: after.fee.status, note: "reason" in action ? action.reason : null }),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    if (action.type === "sendChase") {
      tx.create(db.collection(COL.outbound).doc(), {
        claimId: before.id, to: String(action.message.to).slice(0, 200), subject: String(action.message.subject ?? "").slice(0, 300),
        body: String(action.message.body ?? "").slice(0, 10000), status: "queued", queuedBy: actor.id, createdAt: FieldValue.serverTimestamp(),
      });
    }
    return after;
  });
}
