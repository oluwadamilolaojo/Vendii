import type { PersonName } from "./types";

export function fullName(n: PersonName): string {
  return [n.first, n.middle, n.last].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
}

/**
 * Canonical form used for register matching. Stored on every register entry as holderNameNorm, so search is an exact lookup:
 * strip accents, turn anything that isn't a letter into a space, collapse spaces, uppercase.
 */
export function normalizeName(s: string): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export type VariantKind = "maiden" | "initials" | "surnameFirst" | "firstLast";

export const VARIANT_KINDS: { kind: VariantKind; label: string }[] = [
  { kind: "maiden", label: "Maiden name" },
  { kind: "initials", label: "Initials first" },
  { kind: "surnameFirst", label: "Surname first" },
  { kind: "firstLast", label: "First and surname only" },
];

function initial(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + "." : "";
}

/** A starting point the person edits, not a final answer. Maiden leaves the surname for them to type. */
export function suggestVariant(n: PersonName, kind: VariantKind): string {
  const first = n.first.trim();
  const mid = n.middle.trim();
  const last = n.last.trim();
  switch (kind) {
    case "initials":
      return [initial(first), initial(mid), last].filter(Boolean).join(" ");
    case "surnameFirst":
      return [last ? last.toUpperCase() + "," : "", first, initial(mid)].filter(Boolean).join(" ");
    case "firstLast":
      return [first, last].filter(Boolean).join(" ");
    case "maiden":
      return [first, mid].filter(Boolean).join(" ") + " ";
  }
}

/** Drop blanks, the primary name itself, and anything that normalizes to a spelling we already have. */
export function cleanVariants(list: string[], primary: PersonName): string[] {
  const seen = new Set<string>([normalizeName(fullName(primary))]);
  const out: string[] = [];
  for (const v of list) {
    const key = normalizeName(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim().replace(/\s+/g, " "));
  }
  return out;
}
