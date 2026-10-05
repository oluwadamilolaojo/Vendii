import type { FormsResult } from "@/lib/forms/client";
import type { OpsAction } from "@/lib/domain/actions";
import type { AuditEntry, Claim, ContactDetails, Filing, FlowType, OutboundMessage, PersonName, RegistrarProfile, Settings, StaffMember, StaffRole } from "@/lib/domain/types";

export interface BulkResult {
  done: Claim[];
  failed: { id: string; error: string }[];
}

export interface SearchInput {
  name: PersonName;
  variants: string[];
  bvn?: string;
  nin?: string;
  chn?: string;
}

export interface FilingInput {
  flowType: FlowType;
  name: PersonName;
  variants: string[];
  bvn: string;
  nin: string;
  chn: string;
  address: string;
  contact: ContactDetails;
  /** Resized data URL. Uploaded to storage at filing time. */
  photo: string | null;
  administrator: null | {
    name: PersonName;
    relationship: string;
    phone: string;
    email: string;
    address: string;
    photo: string | null;
    probateDocName: string;
    probateDocPath: string;
  };
  bankName: string;
  accountNumber: string;
  candidates: Claim[];
  selectedIds: string[];
  signature: string;
  poaAcks: boolean[];
  mandateAcks: boolean[];
}

export type UploadKind = "photo" | "probate";

/**
 * The only way the UI touches data. Two implementations: mock (browser storage)
 * and Firebase. Pages never know which one they are talking to.
 */
export interface Repository {
  searchRegisters(input: SearchInput): Promise<Claim[]>;
  fileClaims(input: FilingInput): Promise<Claim[]>;
  listMyClaims(): Promise<Claim[]>;
  getClaim(id: string): Promise<Claim | null>;
  requestChase(id: string): Promise<Claim>;
  resolveException(id: string): Promise<Claim>;
  uploadFile(kind: UploadKind, file: File): Promise<string>;
  ops: {
    listAll(): Promise<Claim[]>;
    /** Sensitive: BVN, NIN, photo, signature. Every call is written to the audit log. */
    getFiling(filingId: string): Promise<Filing | null>;
    /** Any staff action on a claim. The named helpers below are shorthands for this. */
    act(id: string, action: OpsAction): Promise<Claim>;
    /** The same action across many claims. Each claim succeeds or fails on its own. */
    bulk(ids: string[], action: OpsAction): Promise<BulkResult>;
    approve(id: string): Promise<Claim>;
    recordReceipt(id: string, ref: string): Promise<Claim>;
    sendChase(id: string, message: OutboundMessage): Promise<Claim>;
    recordCollection(id: string): Promise<Claim>;
    debitFee(id: string): Promise<Claim>;
    reject(id: string, reason: string): Promise<Claim>;
    raiseException(id: string, reason: string): Promise<Claim>;
    /** Every registrar e-mandate form for a filing, filled from what was filed. */
    downloadForms(filingId: string): Promise<FormsResult>;
    staff(): Promise<StaffMember[]>;
    registrars(): Promise<RegistrarProfile[]>;
    saveRegistrar(p: RegistrarProfile): Promise<RegistrarProfile>;
    settings(): Promise<Settings>;
    saveSettings(s: Settings): Promise<Settings>;
    audit(): Promise<AuditEntry[]>;
    /** Give someone a staff role, change it, or take it away (role null). They must have signed in once on Firebase. */
    setRole(input: { identifier: string; name: string; role: StaffRole | null }): Promise<StaffMember | null>;
  };
}
