import { adminDb } from "@/lib/firebase/admin";
import { COL, SETTINGS_DOC } from "@/lib/data/firestoreShape";
import { auditEntry } from "@/lib/domain/audit";
import { validateSettings } from "@/lib/domain/settings";
import { writeAudit } from "@/lib/server/audit";
import { actorOf, body, caller, handle, requireStaff } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admins only. New SLA deadlines apply from each claim's next status change. */
export const POST = handle(async (req) => {
  const who = await caller(req);
  requireStaff(who, "settings.edit");
  const next = validateSettings(await body(req));
  const db = adminDb();
  await db.collection(COL.config).doc(SETTINGS_DOC).set(next);
  await writeAudit(db, auditEntry(actorOf(who), "settings.update", `Changed SLA policy: ${Object.entries(next.sla).map(([k, v]) => `${k} ${v}`).join(", ")}`));
  return next;
});
