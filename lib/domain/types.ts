export type ClaimStatus =
  | "draft"      // found in search, not filed
  | "review"     // filed by the shareholder, waiting for human review here
  | "submitted"  // pack sent to the registrar, waiting for receipt
  | "chasing"    // receipt confirmed, verification and chase in progress
  | "exception"  // needs something from the shareholder (affidavit, documents)
  | "hold"       // no route yet (older than six years, UFTF not operational)
  | "collected"  // registrar has paid the shareholder, fee not yet debited
  | "paid"       // closed: paid out and fee settled
  | "rejected";  // closed: formally rejected with a written reason

export type Pocket = "registrar" | "uftf";
export type Confidence = "high" | "medium" | "low";
export type FlowType = "own" | "estate";
export type EventState = "done" | "now" | "wait" | "bad";
export type Role = "shareholder" | "ops";

export interface PersonName {
  first: string;
  middle: string;
  last: string;
}

export interface ClaimEvent {
  id: string;
  title: string;
  dateLabel: string;
  state: EventState;
  note?: string | null;
}

export interface Claim {
  id: string;
  registerEntryId?: string | null;
  filingId?: string | null;
  ownerId: string;
  ownerName: string;
  company: string;
  ticker: string;
  registrar: string;
  units: number;
  years: string;
  /** Estimated gross in whole naira until the registrar confirms. */
  amount: number;
  pocket: Pocket;
  confidence: Confidence;
  matchedOn: string;
  matchNote: string;
  status: ClaimStatus;
  exceptionReason?: string | null;
  ref: string | null;
  submittedOn: string | null;
  paidOn: string | null;
  chaseRequested: boolean;
  events: ClaimEvent[];
}

/** Asked for on registrar mandate forms. City and state feed the address boxes; the rest are optional. */
export interface ContactDetails {
  city: string;
  state: string;
  previousAddress: string;
  phone: string;
  email: string;
}

export interface Filing {
  id: string;
  flowType: FlowType;
  name: PersonName;
  variants: string[];
  bvn: string | null;
  nin: string | null;
  chn: string | null;
  address: string | null;
  bankName: string;
  accountNumber: string;
  photoUrl: string | null;
  signatureUrl: string | null;
  administrator: null | {
    name: PersonName;
    relationship: string;
    phone: string;
    email: string | null;
    address: string | null;
    photoUrl: string | null;
    probateDoc: string;
  };
  contact: ContactDetails | null;
  createdAt: string;
}

export interface Session {
  userId: string;
  identifier: string;
  channel: "phone" | "email";
  role: Role;
}

export interface OutboundMessage {
  to: string;
  subject: string;
  body: string;
}
