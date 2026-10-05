/**
 * Makes someone Dividendi staff, or takes it away. They must have signed in once first.
 *
 *   npm run set-role -- +2348031234567 ops
 *   npm run set-role -- you@dividendi.ng ops
 *   npm run set-role -- you@dividendi.ng shareholder
 *
 * The change reaches their browser the next time the app loads.
 */
import { adminAuth } from "@/lib/firebase/adminCore";

async function main() {
  const [who, role] = process.argv.slice(2);
  if (!who || !["ops", "shareholder"].includes(role)) {
    console.error("Usage: npm run set-role -- <phone in +234 format | email> <ops | shareholder>");
    process.exit(1);
  }
  const auth = adminAuth();
  const user = who.includes("@") ? await auth.getUserByEmail(who.toLowerCase()) : await auth.getUserByPhoneNumber(who);
  await auth.setCustomUserClaims(user.uid, role === "ops" ? { ...(user.customClaims ?? {}), role: "ops" } : { ...(user.customClaims ?? {}), role: null });
  console.log(`${who} (${user.uid}) is now ${role}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
