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
/** Staff roles. "ops" was the single staff role before these; it's read as admin. */
export type StaffRole = "agent" | "reviewer" | "finance" | "admin";
export type Role = "shareholder" | StaffRole;

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
  /** Internal only. Never shown to the shareholder. */
  assigneeId?: string | null;
  assigneeName?: string | null;
  /** ISO time the claim entered its current status. Drives the SLA clock. */
  stateSince?: string | null;
  /** ISO deadline for the current status, from the SLA policy. Null when nothing is owed. */
  dueAt?: string | null;
  /** Staff id of whoever approved the pack. That person may not debit or waive its fee. */
  approvedBy?: string | null;
  /** ISO time the pack went to the registrar. Start of the days-to-payment measure. */
  submittedAt?: string | null;
  fee?: FeeState | null;
}

export type FeeStatus = "none" | "requested" | "failed" | "collected" | "waived";

/** The fee on one claim, from the moment the registrar pays until it's collected or waived. */
export interface FeeState {
  status: FeeStatus;
  amount: number;
  /** Quoted on the debit and matched against the bank statement. */
  reference: string;
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  requestedAt: string | null;
  settledAt: string | null;
  waivedReason: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  /** Phone or email they sign in with. */
  identifier: string;
  role: StaffRole;
  active: boolean;
}

export interface Actor {
  id: string;
  name: string;
  role: Role;
}

export interface AuditEntry {
  id: string;
  /** ISO time. */
  at: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  /** Machine name, e.g. "claim.approve", "filing.view", "team.setRole". */
  action: string;
  summary: string;
  claimId?: string | null;
  filingId?: string | null;
  registrarId?: string | null;
  from?: ClaimStatus | null;
  to?: ClaimStatus | null;
}

/**
 * What each registrar demands, learned claim by claim. The acceptance matrix.
 * null means "not confirmed yet", which is different from "they don't require it".
 */
export interface RegistrarRequirements {
  acceptsPoa: boolean | null;
  acceptsEmail: boolean | null;
  wetInkSignature: boolean | null;
  bankStamp: boolean | null;
  affidavitForNameVariants: boolean | null;
  notarisedPoa: boolean | null;
}

export interface RegistrarProfile {
  /** Matches the form template id, e.g. "coronation". */
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  requirements: RegistrarRequirements;
  notes: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Working days allowed in each status before a claim is overdue. */
export interface SlaPolicy {
  review: number;
  submitted: number;
  chasing: number;
  exception: number;
  collected: number;
  /** Chasing this long in total, in working days, means escalate to a named contact. */
  escalateAfter: number;
}

export interface Settings {
  sla: SlaPolicy;
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
  /** Display name for staff. Shareholders don't have one here. */
  name?: string;
}

export interface OutboundMessage {
  to: string;
  subject: string;
  body: string;
}
