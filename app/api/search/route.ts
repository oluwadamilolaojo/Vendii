import { adminDb } from "@/lib/firebase/admin";
import { COL, pocketFor, type RegisterEntryDoc } from "@/lib/data/firestoreShape";
import type { SearchInput } from "@/lib/data/repository";
import { fullName, normalizeName } from "@/lib/domain/names";
import type { Claim } from "@/lib/domain/types";
import { HttpError, body, caller, handle } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Register search. Clients can't read registerEntries, so the only way to see an
 * entry is to already know a spelling of the holder's name.
 */
export const POST = handle(async (req) => {
  await caller(req);
  const input = await body<SearchInput>(req);
  if (!input?.name?.first?.trim() || !input?.name?.last?.trim()) throw new HttpError(400, "A first name and surname are required.");

  const primary = fullName(input.name);
  const spellings = [primary, ...(input.variants ?? [])].map((v) => String(v)).filter((v) => v.trim());
  if (spellings.length > 12) throw new HttpError(400, "Give at most 12 spellings of the name.");
  const norms = Array.from(new Set(spellings.map(normalizeName).filter(Boolean)));

  const snap = await adminDb().collection(COL.register).where("holderNameNorm", "in", norms).get();
  const primaryNorm = normalizeName(primary);

  return snap.docs.map((doc): Claim => {
    const e = doc.data() as RegisterEntryDoc;
    const matchedOn = spellings.find((s) => normalizeName(s) === e.holderNameNorm) ?? primary;
    const exact = e.holderNameNorm === primaryNorm;
    return {
      id: `cand-${doc.id}`, registerEntryId: doc.id, filingId: null, ownerId: "", ownerName: primary,
      company: e.company, ticker: e.ticker ?? "", registrar: e.registrar,
      units: Number(e.units), years: e.years, amount: Number(e.estimatedAmount), pocket: pocketFor(e.declaredOn),
      confidence: exact ? "high" : "medium", matchedOn,
      matchNote: exact ? "Exact match on the full registered name." : "Matched on a spelling you gave us. A person here confirms it before filing.",
      status: "draft", exceptionReason: null, ref: null, submittedOn: null, paidOn: null, chaseRequested: false, events: [],
    };
  });
});
