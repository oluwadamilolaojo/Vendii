import { NextResponse } from "next/server";
import { adminBucket, adminDb } from "@/lib/firebase/admin";
import { COL, claimFromData, type FilingDoc } from "@/lib/data/firestoreShape";
import { fillForms } from "@/lib/forms/fill";
import { REPORT_HEADER, encodeReport, holdingsFromClaims, profileFromFiling } from "@/lib/forms/profile";
import type { Filing } from "@/lib/domain/types";
import { HttpError, caller, requireOps } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function download(path: string | null | undefined): Promise<Uint8Array | null> {
  if (!path) return null;
  try {
    const [buf] = await adminBucket().file(path).download();
    return new Uint8Array(buf);
  } catch {
    return null; // a missing image becomes a warning on the form, not a failed download
  }
}

/** Staff only. Builds every registrar form for one filing, straight from what was filed. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    requireOps(await caller(req));
    const db = adminDb();
    const snap = await db.collection(COL.filings).doc(params.id).get();
    if (!snap.exists) throw new HttpError(404, "That filing doesn't exist.");
    const d = snap.data() as FilingDoc;
    const claims = (await db.collection(COL.claims).where("filingId", "==", params.id).get()).docs.map((c) => claimFromData(c.id, c.data()));
    const { holdings, unmapped } = holdingsFromClaims(claims);
    if (!holdings.length) throw new HttpError(400, "No claim on this filing goes to a registrar with a mapped form.");

    const filing: Filing = {
      id: snap.id, flowType: d.flowType, name: d.name, variants: d.variants, bvn: d.bvn, nin: d.nin, chn: d.chn, address: d.address,
      contact: d.contact ?? null, bankName: d.bankName, accountNumber: d.accountNumber, photoUrl: null, signatureUrl: null,
      administrator: d.administrator && { ...d.administrator, photoUrl: null, probateDoc: d.administrator.probateDocName },
      createdAt: d.createdLabel,
    };
    // Estates: the administrator's photo, since the shareholder has died.
    const photo = await download(d.administrator?.photoPath ?? d.photoPath);
    const signature = await download(d.poa?.signaturePath);
    const { pdf, forms } = await fillForms(profileFromFiling(filing), holdings, { photo, signature });
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="mandates-${snap.id}.pdf"`,
        [REPORT_HEADER]: encodeReport({ forms, unmapped: unmapped.map((c) => `${c.company} (${c.registrar})`) }),
        "access-control-expose-headers": REPORT_HEADER,
      },
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError)) console.error(e);
    return NextResponse.json({ error: e instanceof HttpError ? e.message : "Couldn't build the forms. Try again." }, { status });
  }
}
