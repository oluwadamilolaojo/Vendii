import directoryJson from "./directory.json";
import type { FormProfile } from "./types";

export interface DirectoryEntry { company: string; registrarId: string; registrar: string }
export const DIRECTORY = directoryJson as DirectoryEntry[];

/** Words that don't help tell companies apart. */
const NOISE = new Set(["PLC", "LTD", "LIMITED", "NIG", "NIGERIA", "NIGERIAN", "COMPANY", "CO", "THE", "OF", "AND", "INT", "INTL"]);

export function companyTokens(s: string): string[] {
  return (s ?? "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\([^)]*FORMERLY[^)]*\)/g, " ") // "(Formerly ...)" is history, not the name
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t, i, all) => t && !NOISE.has(t) && all.indexOf(t) === i);
}

/**
 * How well a typed name matches a listed one, 0 to 1. Every token the person typed has to
 * appear (as a whole word or a prefix of one) for a strong score, so "Coronation Insurance"
 * finds "Coronation Insurance PLC (WAPIC Insurance)" but not "Coronation Asset Management".
 */
export function matchScore(query: string, listed: string): number {
  const q = companyTokens(query);
  const l = companyTokens(listed);
  if (!q.length || !l.length) return 0;
  let hit = 0;
  for (const t of q) if (l.some((w) => w === t || (t.length >= 3 && w.startsWith(t)))) hit++;
  const recall = hit / q.length;
  const precision = hit / l.length;
  return recall === 1 ? 0.6 + 0.4 * precision : recall * 0.5;
}

export function searchCompanies(query: string, limit = 12): (DirectoryEntry & { score: number })[] {
  if (query.trim().length < 2) return [];
  return DIRECTORY
    .map((e) => ({ ...e, score: matchScore(query, e.company) }))
    .filter((e) => e.score >= 0.6)
    .sort((a, b) => b.score - a.score || a.company.length - b.company.length)
    .slice(0, limit);
}

/** Best listed company on one registrar's form for a name, or null if none is a confident match. */
export function bestCompanyOnForm(registrarId: string, company: string): string | null {
  let best: { name: string; score: number } | null = null;
  for (const e of DIRECTORY) {
    if (e.registrarId !== registrarId) continue;
    const score = matchScore(company, e.company);
    if (!best || score > best.score) best = { name: e.company, score };
  }
  // Ticking is stricter than searching: every typed word must be there AND at least half of the
  // listed name must be accounted for. "FBN Holdings" must not tick "FBN Heritage Fund".
  return best && best.score >= 0.8 ? best.name : null;
}

const REGISTRAR_ALIASES: Record<string, string> = {
  CORONATION: "coronation", APEL: "apel", ATLAS: "atlas", CARDINALSTONE: "cardinalstone", CARDINAL: "cardinalstone",
  CARNATION: "carnation", CENTURION: "centurion", CORDROS: "cordros", DATAMAX: "datamax", EDC: "edc",
  FLOUR: "flourmills", FIRST: "first", GREENWICH: "greenwich", GTL: "greenwich", LANCELOT: "lancelot",
  LIGHTHOUSE: "lighthouse", MAINSTREET: "mainstreet", MAINSTREETBANK: "mainstreet", MERISTEM: "meristem",
  PAC: "pac", PACE: "pace", STERLING: "pace", UNITY: "unity", VERITAS: "veritas", AFRICA: "africaprudential", AFRIPRUDENTIAL: "africaprudential",
};

/** "CardinalStone Registrars", "Africa Prudential Registrars Plc", "GTL Registrars" -> template id. */
export function registrarIdFor(name: string): string | null {
  const first = (name ?? "").toUpperCase().replace(/[^A-Z ]/g, " ").trim().split(/\s+/)[0] ?? "";
  if (first === "PAC" && /PACE/i.test(name)) return "pace";
  return REGISTRAR_ALIASES[first] ?? null;
}

export const emptyProfile = (): FormProfile => ({
  surname: "", firstName: "", otherNames: "", bvn: "", bankName: "", accountNumber: "",
  address: "", city: "", state: "", country: "Nigeria", previousAddress: "", chn: "", phone1: "", phone2: "", email: "",
});
