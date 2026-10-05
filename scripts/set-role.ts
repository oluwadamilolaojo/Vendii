/**
 * Gives someone a staff role, changes it, or takes it away. They must have signed in once first.
 * Use this for the first admin; after that, admins manage the team from Admin > Team.
 *
 *   npm run set-role -- you@vendii.ng admin "Damilola Ojo"
 *   npm run set-role -- +2348031234567 agent "Tobi Adeyemi"
 *   npm run set-role -- someone@vendii.ng none
 *
 * Roles: agent, reviewer, finance, admin, or none to remove staff access.
 */
import { adminAuth, adminDb } from "@/lib/firebase/adminCore";
import { COL } from "@/lib/data/firestoreShape";
import { STAFF_ROLES } from "@/lib/domain/permissions";
import type { StaffRole } from "@/lib/domain/types";

async function main() {
  const [who, roleArg, ...nameParts] = process.argv.slice(2);
  const role = roleArg === "none" ? null : (roleArg as StaffRole);
  if (!who || (role !== null && !STAFF_ROLES.includes(role))) {
    console.error(`Usage: npm run set-role -- <email | +234 phone> <${STAFF_ROLES.join(" | ")} | none> ["Full Name"]`);
    process.exit(1);
  }
  const auth = adminAuth();
  const user = who.includes("@") ? await auth.getUserByEmail(who.toLowerCase()) : await auth.getUserByPhoneNumber(who);
  const name = nameParts.join(" ").trim() || user.displayName || who;
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role, name: role ? name : null });
  await auth.revokeRefreshTokens(user.uid);
  await adminDb().collection(COL.staff).doc(user.uid).set({ id: user.uid, name, identifier: who, role: role ?? "agent", active: role !== null });
  console.log(role ? `${name} (${who}) is now ${role}.` : `${name} (${who}) no longer has staff access.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
