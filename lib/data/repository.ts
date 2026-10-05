import type { FormsResult } from "@/lib/forms/client";
import type { Claim, ContactDetails, Filing, FlowType, OutboundMessage, PersonName } from "@/lib/domain/types";

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
    getFiling(filingId: string): Promise<Filing | null>;
    approve(id: string): Promise<Claim>;
    recordReceipt(id: string, ref: string): Promise<Claim>;
    sendChase(id: string, message: OutboundMessage): Promise<Claim>;
    recordCollection(id: string): Promise<Claim>;
    debitFee(id: string): Promise<Claim>;
    reject(id: string, reason: string): Promise<Claim>;
    raiseException(id: string, reason: string): Promise<Claim>;
    /** Every registrar e-mandate form for a filing, filled from what was filed. */
    downloadForms(filingId: string): Promise<FormsResult>;
  };
}
