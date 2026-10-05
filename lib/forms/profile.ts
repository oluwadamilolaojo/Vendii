import type { Claim, Filing } from "@/lib/domain/types";
import { registrarIdFor } from "./registry";
import type { FormProfile, Holding } from "./types";

/**
 * A filing, as the forms need it. For an estate the names are the deceased's, because
 * that's whose name is on the register; contact details come from the administrator.
 */
export function profileFromFiling(f: Filing): FormProfile {
  const a = f.administrator;
  const c = f.contact;
  return {
    surname: f.name.last, firstName: f.name.first, otherNames: f.name.middle,
    bvn: f.bvn ?? "", bankName: f.bankName, accountNumber: f.accountNumber,
    address: f.address ?? a?.address ?? "", city: c?.city ?? "", state: c?.state ?? "", country: "Nigeria",
    previousAddress: c?.previousAddress ?? "", chn: f.chn ?? "",
    phone1: a?.phone || c?.phone || "", phone2: "", email: a?.email || c?.email || "",
  };
}

/** Claims to form holdings. Claims whose registrar has no mapped form come back separately. */
export function holdingsFromClaims(claims: Claim[]): { holdings: Holding[]; unmapped: Claim[] } {
  const holdings: Holding[] = [];
  const unmapped: Claim[] = [];
  for (const c of claims) {
    if (c.status === "rejected" || c.status === "hold") continue; // nothing to file for these
    const registrarId = registrarIdFor(c.registrar);
    if (registrarId) holdings.push({ registrarId, company: c.company });
    else unmapped.push(c);
  }
  return { holdings, unmapped };
}

/** The filler's report travels in a response header next to the PDF. */
export const REPORT_HEADER = "x-dividendi-forms";
export interface FormsReport {
  forms: { registrarId: string; registrar: string; ticked: string[]; unlisted: string[]; warnings: { message: string }[] }[];
  unmapped?: string[];
}
export const encodeReport = (r: FormsReport) => Buffer.from(JSON.stringify(r)).toString("base64");
export function decodeReport(h: string | null): FormsReport | null {
  if (!h) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(h)))) as FormsReport; } catch { return null; }
}
