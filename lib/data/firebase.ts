import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { ref, uploadBytes, uploadString } from "firebase/storage";
import { firebaseAuth } from "@/lib/auth/firebase";
import { fbAuth, fbDb, fbStorage } from "@/lib/firebase/client";
import type { ClaimAction } from "@/lib/domain/actions";
import { postForForms } from "@/lib/forms/client";
import { withDefaults } from "@/lib/domain/registrarDesk";
import { mergeSettings } from "@/lib/domain/settings";
import type { AuditEntry, Claim, Filing, RegistrarProfile, Settings, StaffMember } from "@/lib/domain/types";
import { COL, SETTINGS_DOC, claimFromData, type FilingPayload } from "./firestoreShape";
import type { BulkResult, Repository } from "./repository";

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
      const snap = await getDocs(query(collection(fbDb(), COL.claims), orderBy("updatedAt", "desc"), limit(1000)));
      return snap.docs.map((d) => claimFromData(d.id, d.data()));
    },

    // Through the server, so the view is audited and documents come back as 15-minute links.
    getFiling: (filingId) => api<Filing>(`/api/ops/filing/${encodeURIComponent(filingId)}`, {}).catch((e) => {
      if (/doesn't exist/.test(String(e?.message))) return null;
      throw e;
    }),

    act: (id, action) => act(id, action),
    bulk: (ids, action) => api<BulkResult>("/api/claims/bulk", { ids, action }),
    approve: (id) => act(id, { type: "approve" }),
    recordReceipt: (id, ref) => act(id, { type: "recordReceipt", ref }),
    sendChase: (id, message) => act(id, { type: "sendChase", message }),
    recordCollection: (id) => act(id, { type: "recordCollection" }),
    debitFee: (id) => act(id, { type: "debitFee" }),
    reject: (id, reason) => act(id, { type: "reject", reason }),
    raiseException: (id, reason) => act(id, { type: "raiseException", reason }),
    downloadForms: (filingId) => postForForms(`/api/forms/filing/${encodeURIComponent(filingId)}`),

    async staff() {
      const snap = await getDocs(query(collection(fbDb(), COL.staff), where("active", "==", true)));
      return snap.docs.map((d) => ({ ...(d.data() as StaffMember), id: d.id })).sort((a, b) => a.name.localeCompare(b.name));
    },
    async registrars() {
      const snap = await getDocs(collection(fbDb(), COL.registrars));
      return withDefaults(snap.docs.map((d) => ({ ...(d.data() as RegistrarProfile), id: d.id })));
    },
    saveRegistrar: (p) => api<RegistrarProfile>("/api/admin/registrars", p),
    async settings() {
      const d = await getDoc(doc(fbDb(), COL.config, SETTINGS_DOC));
      return mergeSettings(d.exists() ? (d.data() as Settings) : null);
    },
    saveSettings: (next) => api<Settings>("/api/admin/settings", next),
    async audit() {
      const snap = await getDocs(query(collection(fbDb(), COL.audit), orderBy("at", "desc"), limit(1000)));
      return snap.docs.map((d) => d.data() as AuditEntry);
    },
    setRole: (input) => api<StaffMember | null>("/api/admin/team", input),
  },
};
