import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { COL } from "@/lib/data/firestoreShape";
import type { AuditEntry } from "@/lib/domain/types";

export async function writeAudit(db: Firestore, entry: AuditEntry): Promise<void> {
  await db.collection(COL.audit).doc(entry.id).set(entry);
}
