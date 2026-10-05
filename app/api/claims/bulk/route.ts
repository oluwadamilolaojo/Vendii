import type { BulkResult } from "@/lib/data/repository";
import { adminDb } from "@/lib/firebase/admin";
import { loadSettings, parseAction, runClaimAction } from "@/lib/server/claimAction";
import { HttpError, body, caller, handle, requireStaff } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The same staff action on many claims. Each claim is its own transaction, so one claim in the
 * wrong state fails alone and the rest go through. The response says which.
 */
export const POST = handle(async (req) => {
  const who = await caller(req);
  requireStaff(who);
  const b = await body<{ ids?: unknown; action?: unknown }>(req);
  const ids = Array.isArray(b.ids) ? [...new Set(b.ids.filter((x): x is string => typeof x === "string" && /^[\w-]{1,128}$/.test(x)))] : [];
  if (!ids.length) throw new HttpError(400, "Pick at least one claim.");
  if (ids.length > 100) throw new HttpError(400, "Up to 100 claims at a time.");
  const action = parseAction(b.action);
  if (action.type === "requestChase" || action.type === "resolveException") throw new HttpError(400, "That isn't a staff action.");
  const db = adminDb();
  const settings = await loadSettings(db);
  const out: BulkResult = { done: [], failed: [] };
  for (const id of ids) {
    try { out.done.push(await runClaimAction(db, who, id, action, settings, true)); }
    catch (e) { out.failed.push({ id, error: e instanceof Error ? e.message : "Failed" }); }
  }
  return out;
});
