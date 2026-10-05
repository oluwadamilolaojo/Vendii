import { adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/data/firestoreShape";
import { auditEntry } from "@/lib/domain/audit";
import { defaultRegistrarProfiles } from "@/lib/domain/registrarDesk";
import type { RegistrarProfile, RegistrarRequirements } from "@/lib/domain/types";
import { writeAudit } from "@/lib/server/audit";
import { HttpError, actorOf, body, caller, handle, requireStaff } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN = new Set(defaultRegistrarProfiles().map((r) => r.id));
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const tri = (v: unknown) => (v === true ? true : v === false ? false : null);

/** Save one registrar's contacts, acceptance matrix and notes. Reviewers and admins. */
export const POST = handle(async (req) => {
  const who = await caller(req);
  requireStaff(who, "registrars.edit");
  const p = await body<RegistrarProfile>(req);
  if (!p?.id || !KNOWN.has(p.id)) throw new HttpError(400, "Unknown registrar.");
  const r = (p.requirements ?? {}) as Partial<RegistrarRequirements>;
  const saved: RegistrarProfile = {
    id: p.id, name: str(p.name, 120), contactName: str(p.contactName, 120), email: str(p.email, 160), phone: str(p.phone, 40), address: str(p.address, 400),
    requirements: {
      acceptsPoa: tri(r.acceptsPoa), acceptsEmail: tri(r.acceptsEmail), wetInkSignature: tri(r.wetInkSignature),
      bankStamp: tri(r.bankStamp), affidavitForNameVariants: tri(r.affidavitForNameVariants), notarisedPoa: tri(r.notarisedPoa),
    },
    notes: str(p.notes, 4000), updatedAt: new Date().toISOString(), updatedBy: who.name,
  };
  const db = adminDb();
  await db.collection(COL.registrars).doc(saved.id).set(saved);
  await writeAudit(db, auditEntry(actorOf(who), "registrar.update", `Updated ${saved.name}: contacts, requirements or notes`, { registrarId: saved.id }));
  return saved;
});
