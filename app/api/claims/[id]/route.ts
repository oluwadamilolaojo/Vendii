import { adminDb } from "@/lib/firebase/admin";
import { loadSettings, parseAction, runClaimAction } from "@/lib/server/claimAction";
import { body, caller, handle } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Any change to one claim after filing. Permissions, SLA and audit live in runClaimAction. */
export const POST = handle(async (req, { params }) => {
  const who = await caller(req);
  const action = parseAction(await body(req));
  const db = adminDb();
  return runClaimAction(db, who, params.id, action, await loadSettings(db));
});
