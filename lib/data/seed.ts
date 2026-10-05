import { fullName } from "@/lib/domain/names";
import type { Claim, ClaimEvent, Confidence, Pocket } from "@/lib/domain/types";
import type { SearchInput } from "./repository";

interface Holding {
  key: string;
  company: string;
  ticker: string;
  registrar: string;
  units: number;
  years: string;
  amount: number;
  pocket: Pocket;
  confidence: Confidence;
  variantIndex: number;
  matchNote: string;
}

/** Demo register entries. Registrar assignments match the companies listed on each registrar's own form. */
export const DEMO_HOLDINGS: Holding[] = [
  { key: "okomu", company: "Okomu Oil Palm", ticker: "OKOMUOIL", registrar: "CardinalStone Registrars", units: 4200,
    years: "FY2022 \u2013 FY2025", amount: 1432000, pocket: "registrar", confidence: "high", variantIndex: 2,
    matchNote: "CHN matched on the middle-initial spelling. Interim and final dividends both captured." },
  { key: "zenith", company: "Zenith Bank", ticker: "ZENITHBANK", registrar: "Veritas Registrars", units: 12500,
    years: "FY2019 \u2013 FY2023", amount: 486250, pocket: "registrar", confidence: "high", variantIndex: 0,
    matchNote: "Exact register match on BVN." },
  { key: "uba", company: "United Bank for Africa", ticker: "UBA", registrar: "Africa Prudential Registrars", units: 8000,
    years: "FY2021 \u2013 FY2024", amount: 214400, pocket: "registrar", confidence: "medium", variantIndex: 1,
    matchNote: "The register carries initials only. Expect the registrar to ask for an affidavit tying it to your NIN." },
  { key: "dangcem", company: "Dangote Cement", ticker: "DANGCEM", registrar: "Coronation Registrars", units: 900,
    years: "FY2023", amount: 27000, pocket: "registrar", confidence: "high", variantIndex: 0,
    matchNote: "Exact register match on BVN." },
  { key: "cadbury", company: "Cadbury Nigeria", ticker: "CADBURY", registrar: "First Registrars", units: 3100,
    years: "FY2016 \u2013 FY2018", amount: 58900, pocket: "uftf", confidence: "medium", variantIndex: 3,
    matchNote: "Older than six years, so it sits outside the registrar's normal window." },
  { key: "gtco", company: "Guaranty Trust Holding", ticker: "GTCO", registrar: "Datamax Registrars", units: 5400,
    years: "FY2020 \u2013 FY2022", amount: 91800, pocket: "registrar", confidence: "low", variantIndex: 1,
    matchNote: "Possible match on initials. A person here confirms it before anything is filed." },
];

export { HOLD_NOTE } from "@/lib/domain/actions";
import { HOLD_NOTE } from "@/lib/domain/actions";

export function buildCandidates(input: SearchInput): Claim[] {
  const primary = fullName(input.name);
  const spellings = [primary, ...input.variants].filter((v) => v.trim());
  return DEMO_HOLDINGS.map((h) => ({
    id: `cand-${h.key}`,
    registerEntryId: `demo-${h.key}`,
    filingId: null,
    ownerId: "",
    ownerName: primary,
    company: h.company,
    ticker: h.ticker,
    registrar: h.registrar,
    units: h.units,
    years: h.years,
    amount: h.amount,
    pocket: h.pocket,
    confidence: h.confidence,
    matchedOn: spellings[h.variantIndex % spellings.length] ?? primary,
    matchNote: h.matchNote,
    status: "draft",
    exceptionReason: null,
    ref: null,
    submittedOn: null,
    paidOn: null,
    chaseRequested: false,
    events: [],
  }));
}

let n = 0;
const e = (title: string, dateLabel: string, state: ClaimEvent["state"], note?: string): ClaimEvent =>
  ({ id: `seed-${++n}`, title, dateLabel, state, note: note ?? null });

/** A realistic spread of claims in every state, for demos and for building the ops screens. */
export function buildSampleHistory(ownerId: string, ownerName: string): Claim[] {
  const base = buildCandidates({ name: { first: ownerName, middle: "", last: "" }, variants: ["A. B. Ogunyemi", "Adewale B. Ogunyemi", "Adewale Ogunyemi"] });
  const by = (k: string) => ({ ...base.find((c) => c.id === `cand-${k}`)!, id: `sample-${k}`, ownerId, ownerName, filingId: "sample-filing" });
  return [
    { ...by("okomu"), status: "chasing", ref: "CSR/UD/24-88104", submittedOn: "12 Aug 2026", events: [
      e("Claim pack received", "10 Aug 2026", "done", "Authority signed and pack assembled for CardinalStone Registrars."),
      e("Human review", "11 Aug 2026", "done", "Checked and approved."),
      e("Filed with CardinalStone Registrars", "12 Aug 2026", "done"),
      e("Receipt confirmed", "15 Aug 2026", "done", "Reference CSR/UD/24-88104 issued."),
      e("Status check 1", "29 Aug 2026", "done", "Verification in progress. FY2022 and FY2023 warrants located."),
      e("Status check 2", "12 Sep 2026", "now", "FY2024 and FY2025 entitlement being confirmed against the register."),
      e("Payment to your account", "Expected late Sep", "wait"),
    ] },
    { ...by("zenith"), status: "paid", ref: "VR/DIV/9921-A", submittedOn: "29 Jul 2026", paidOn: "4 Sep 2026", events: [
      e("Filed with Veritas Registrars", "29 Jul 2026", "done"),
      e("Receipt confirmed", "1 Aug 2026", "done", "Reference VR/DIV/9921-A issued."),
      e("Escalated to named contact", "28 Aug 2026", "done", "Four weeks without movement. Escalated to the unclaimed dividends desk."),
      e("Registrar paid your account", "4 Sep 2026", "done", "\u20A6486,250 credited to your GTBank account."),
      e("Fee debited via NIBSS mandate", "5 Sep 2026", "done", "You were told \u20A648,625 in advance. Net received: \u20A6437,625."),
    ] },
    { ...by("uba"), status: "exception", exceptionReason: "Name mismatch", ref: "AP/UD/24-88117", submittedOn: "12 Aug 2026", events: [
      e("Filed with Africa Prudential Registrars", "12 Aug 2026", "done"),
      e("Receipt confirmed", "16 Aug 2026", "done"),
      e("Name mismatch raised", "27 Aug 2026", "bad", "The register shows A. B. OGUNYEMI. Your NIN reads ADEWALE BAMIDELE OGUNYEMI."),
      e("Affidavit of name variation", "Waiting on you", "now", "Sworn at a High Court registry and anchored to your NIN. We have drafted it and pay the registry fee."),
      e("Resubmission and payment", "Not started", "wait"),
    ] },
    { ...by("dangcem"), status: "submitted", submittedOn: "9 Sep 2026", events: [
      e("Filed with Coronation Registrars", "9 Sep 2026", "done"),
      e("Receipt confirmation", "Expected by 16 Sep", "now", "We chase this at day 7 if nothing arrives."),
      e("Payment to your account", "Not started", "wait"),
    ] },
    { ...by("cadbury"), status: "hold", events: [
      e("Identified in your claim map", "9 Sep 2026", "done"),
      e("On hold", "Now", "now", HOLD_NOTE),
    ] },
    { ...by("gtco"), status: "rejected", ref: "DMX/UC/5540", submittedOn: "5 Aug 2026", events: [
      e("Filed with Datamax Registrars", "5 Aug 2026", "done"),
      e("Receipt confirmed", "8 Aug 2026", "done"),
      e("Rejected", "2 Sep 2026", "bad", "The holding was transferred out in March 2019 and carries no outstanding entitlement. This was a different A. B. Ogunyemi. No fee charged."),
    ] },
  ];
}
