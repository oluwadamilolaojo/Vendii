import { NextResponse } from "next/server";
import { DATA_SOURCE } from "@/lib/config";
import { dataUrlBytes, fillForms, templateById } from "@/lib/forms/fill";
import { REPORT_HEADER, encodeReport } from "@/lib/forms/profile";
import type { FormProfile, Holding } from "@/lib/forms/types";
import { HttpError, caller } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  profile: FormProfile;
  holdings: Holding[];
  photo?: string | null;
  signature?: string | null;
}

const FIELDS: (keyof FormProfile)[] = ["surname", "firstName", "otherNames", "bvn", "bankName", "accountNumber", "address", "city", "state", "country", "previousAddress", "chn", "phone1", "phone2", "email"];

/**
 * Fills registrar e-mandate forms from one set of details. Returns a single PDF with a
 * page per registrar; the report header says what was ticked and what needs a pen.
 */
export async function POST(req: Request) {
  try {
    if (DATA_SOURCE === "firebase") await caller(req);
    const b = (await req.json().catch(() => null)) as Body | null;
    if (!b?.profile || !Array.isArray(b.holdings)) throw new HttpError(400, "Send a profile and at least one holding.");
    const profile = Object.fromEntries(FIELDS.map((k) => [k, String(b.profile[k] ?? "").slice(0, 300)])) as unknown as FormProfile;
    if (!profile.surname.trim() || !profile.firstName.trim()) throw new HttpError(400, "A first name and surname are needed on every form.");
    const holdings = b.holdings
      .filter((h) => h && typeof h.registrarId === "string" && typeof h.company === "string")
      .map((h) => ({ registrarId: h.registrarId, company: h.company.slice(0, 200) }))
      .slice(0, 100);
    if (!holdings.length) throw new HttpError(400, "Pick at least one company.");
    for (const h of holdings) if (!templateById(h.registrarId)) throw new HttpError(400, `No form is mapped for ${h.registrarId}.`);

    const { pdf, forms } = await fillForms(profile, holdings, { photo: dataUrlBytes(b.photo), signature: dataUrlBytes(b.signature) });
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="dividendi-mandates-${profile.surname.replace(/[^\w-]/g, "") || "forms"}.pdf"`,
        [REPORT_HEADER]: encodeReport({ forms }),
        "access-control-expose-headers": REPORT_HEADER,
      },
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 400;
    const msg = e instanceof Error ? e.message : "Couldn't build the forms.";
    if (!(e instanceof HttpError)) console.error(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
