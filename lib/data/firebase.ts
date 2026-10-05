import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes, uploadString } from "firebase/storage";
import { firebaseAuth } from "@/lib/auth/firebase";
import { fbAuth, fbDb, fbStorage } from "@/lib/firebase/client";
import type { ClaimAction } from "@/lib/domain/actions";
import { postForForms } from "@/lib/forms/client";
import type { Claim, Filing } from "@/lib/domain/types";
import { COL, claimFromData, type FilingDoc, type FilingPayload } from "./firestoreShape";
import type { Repository } from "./repository";

function uid(): string {
  const u = fbAuth().currentUser;
  if (!u) throw new Error("Sign in to continue.");
  return u.uid;
}

/** Our own API routes. Every call carries the Firebase ID token; the server checks it and the role. */
async function api<T>(path: string, payload: unknown): Promise<T> {
  const token = await firebaseAuth.idToken!();
  if (!token) throw new Error("Sign in to continue.");
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data as T;
}

const act = (id: string, action: ClaimAction) => api<Claim>(`/api/claims/${encodeURIComponent(id)}`, action);

const safe = (name: string) => name.replace(/[^\w.-]/g, "_").slice(-80);

async function uploadDataUrl(path: string, dataUrl: string): Promise<string> {
  await uploadString(ref(fbStorage(), path), dataUrl, "data_url");
  return path;
}

async function url(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try {
    return await getDownloadURL(ref(fbStorage(), path));
  } catch {
    return null;
  }
}

function byNewest(a: { t: number }, b: { t: number }) {
  return b.t - a.t;
}

export const firebaseRepository: Repository = {
  searchRegisters: (input) => api<Claim[]>("/api/search", input),

  async fileClaims(input) {
    const me = uid();
    const stamp = Date.now();
    const photoPath = input.photo ? await uploadDataUrl(`identity-photos/${me}/${stamp}-shareholder.jpg`, input.photo) : null;
    const signaturePath = await uploadDataUrl(`signatures/${me}/${stamp}-authority.png`, input.signature);

    let administrator: FilingPayload["administrator"] = null;
    if (input.administrator) {
      const a = input.administrator;
      administrator = {
        name: a.name, relationship: a.relationship, phone: a.phone, email: a.email, address: a.address,
        photoPath: a.photo ? await uploadDataUrl(`identity-photos/${me}/${stamp}-administrator.jpg`, a.photo) : null,
        probateDocName: a.probateDocName, probateDocPath: a.probateDocPath,
      };
    }

    // Selected registrar claims, plus every older one: those are filed on hold at no charge.
    const entryIds = input.candidates
      .filter((c) => c.pocket === "uftf" || input.selectedIds.includes(c.id))
      .map((c) => c.registerEntryId)
      .filter((x): x is string => !!x);

    const payload: FilingPayload = {
      flowType: input.flowType, name: input.name, variants: input.variants,
      bvn: input.bvn, nin: input.nin, chn: input.chn, address: input.address, contact: input.contact, photoPath,
      administrator, bankName: input.bankName, accountNumber: input.accountNumber,
      entryIds, signaturePath, poaAcks: input.poaAcks, mandateAcks: input.mandateAcks,
    };
    return api<Claim[]>("/api/claims/file", payload);
  },

  async listMyClaims() {
    const snap = await getDocs(query(collection(fbDb(), COL.claims), where("ownerId", "==", uid())));
    return snap.docs
      .map((d) => ({ c: claimFromData(d.id, d.data()), t: d.data().createdAt?.toMillis?.() ?? 0 }))
      .sort(byNewest)
      .map((x) => x.c);
  },

  async getClaim(id) {
    try {
      const d = await getDoc(doc(fbDb(), COL.claims, id));
      return d.exists() ? claimFromData(d.id, d.data()) : null;
    } catch {
      // Rules deny reads of other people's claims. To the UI that's the same as not found.
      return null;
    }
  },

  requestChase: (id) => act(id, { type: "requestChase" }),
  resolveException: (id) => act(id, { type: "resolveException" }),

  async uploadFile(kind, file) {
    const folder = kind === "probate" ? "estate-documents" : "identity-photos";
    const path = `${folder}/${uid()}/${Date.now()}-${safe(file.name)}`;
    await uploadBytes(ref(fbStorage(), path), file, { contentType: file.type });
    return path;
  },

  ops: {
    async listAll() {
      const snap = await getDocs(query(collection(fbDb(), COL.claims), orderBy("updatedAt", "desc"), limit(500)));
      return snap.docs.map((d) => claimFromData(d.id, d.data()));
    },

    async getFiling(filingId) {
      const d = await getDoc(doc(fbDb(), COL.filings, filingId));
      if (!d.exists()) return null;
      const r = d.data() as FilingDoc;
      const a = r.administrator;
      const filing: Filing = {
        id: d.id, flowType: r.flowType, name: r.name, variants: r.variants ?? [],
        bvn: r.bvn, nin: r.nin, chn: r.chn, address: r.address, contact: r.contact ?? null,
        bankName: r.bankName, accountNumber: r.accountNumber,
        photoUrl: await url(r.photoPath),
        signatureUrl: await url(r.poa?.signaturePath),
        administrator: a ? {
          name: a.name, relationship: a.relationship, phone: a.phone, email: a.email, address: a.address,
          photoUrl: await url(a.photoPath),
          probateDoc: (await url(a.probateDocPath)) ?? a.probateDocName,
        } : null,
        createdAt: r.createdLabel,
      };
      return filing;
    },

    approve: (id) => act(id, { type: "approve" }),
    recordReceipt: (id, ref) => act(id, { type: "recordReceipt", ref }),
    sendChase: (id, message) => act(id, { type: "sendChase", message }),
    recordCollection: (id) => act(id, { type: "recordCollection" }),
    debitFee: (id) => act(id, { type: "debitFee" }),
    reject: (id, reason) => act(id, { type: "reject", reason }),
    raiseException: (id, reason) => act(id, { type: "raiseException", reason }),
    downloadForms: (filingId) => postForForms(`/api/forms/filing/${encodeURIComponent(filingId)}`),
  },
};
