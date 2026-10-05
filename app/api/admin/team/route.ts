import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COL } from "@/lib/data/firestoreShape";
import { auditEntry } from "@/lib/domain/audit";
import { STAFF_ROLES } from "@/lib/domain/permissions";
import type { StaffMember, StaffRole } from "@/lib/domain/types";
import { writeAudit } from "@/lib/server/audit";
import { HttpError, actorOf, body, caller, handle, requireStaff } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admins give, change or remove staff roles. The role goes in the person's Auth custom claim
 * (what every route and rule checks) and the staff directory (names for assignment).
 */
export const POST = handle(async (req) => {
  const who = await caller(req);
  requireStaff(who, "team.manage");
  const b = await body<{ identifier?: string; name?: string; role?: StaffRole | null }>(req);
  const identifier = String(b.identifier ?? "").trim();
  if (!identifier) throw new HttpError(400, "Enter the email or phone number they sign in with.");
  const role = b.role ?? null;
  if (role !== null && !STAFF_ROLES.includes(role)) throw new HttpError(400, "Unknown role.");
  const auth = adminAuth();
  let user;
  try {
    user = identifier.includes("@") ? await auth.getUserByEmail(identifier.toLowerCase()) : await auth.getUserByPhoneNumber(identifier.replace(/\s/g, ""));
  } catch {
    throw new HttpError(404, "No account uses that yet. Ask them to sign in to Vendii once, then try again. Phone numbers need the +234 form.");
  }
  if (user.uid === who.uid) throw new HttpError(403, "You can't change your own role. Ask another admin.");
  const name = String(b.name ?? "").trim().slice(0, 80) || user.displayName || identifier;
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role, name: role ? name : null });
  // Revoke so the old role stops working now, not when their token next refreshes in up to an hour.
  await auth.revokeRefreshTokens(user.uid);
  const member: StaffMember = { id: user.uid, name, identifier, role: role ?? "agent", active: role !== null };
  const db = adminDb();
  await db.collection(COL.staff).doc(user.uid).set(member);
  await writeAudit(db, auditEntry(actorOf(who), "team.setRole", role ? `Gave ${name} the ${role} role` : `Removed staff access for ${name}`));
  return role ? member : null;
});
