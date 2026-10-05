import type { Role, StaffRole } from "./types";

export const STAFF_ROLES: readonly StaffRole[] = ["agent", "reviewer", "finance", "admin"];

export const ROLE_LABEL: Record<Role, string> = {
  shareholder: "Shareholder", agent: "Agent", reviewer: "Reviewer", finance: "Finance", admin: "Admin",
};

export const ROLE_BLURB: Record<StaffRole, string> = {
  agent: "Works claims: records receipts, writes chases, assigns claims to themselves.",
  reviewer: "Everything an agent does, plus approving packs, rejections, exceptions, assigning work and editing registrar requirements.",
  finance: "Records registrar payments and runs fee debits, retries and reconciliation. Can't approve claims.",
  admin: "Everything, plus the team, the audit log and settings.",
};

export type Permission =
  | "queue.view"        // see the claims queue
  | "claims.work"       // receipts, chases, assign to self
  | "claims.approve"    // approve, reject, raise exceptions
  | "claims.assign"     // assign anyone's work
  | "filings.view"      // see BVN, NIN, photo, signature
  | "money.manage"      // record collections, request and record debits
  | "money.waive"       // waive a fee
  | "registrars.edit"   // change contacts and the acceptance matrix
  | "team.manage"       // give and take staff roles
  | "audit.view"
  | "settings.edit";

const MATRIX: Record<StaffRole, readonly Permission[]> = {
  agent: ["queue.view", "claims.work", "filings.view"],
  reviewer: ["queue.view", "claims.work", "claims.approve", "claims.assign", "filings.view", "registrars.edit"],
  // Finance sees claims through the money room. It doesn't need anyone's BVN or passport photo.
  finance: ["queue.view", "money.manage"],
  admin: ["queue.view", "claims.work", "claims.approve", "claims.assign", "filings.view", "money.manage", "money.waive", "registrars.edit", "team.manage", "audit.view", "settings.edit"],
};

/** Legacy "ops" claims become admin so nobody is locked out by the role split. */
export function normaliseRole(raw: unknown): Role {
  if (raw === "ops") return "admin";
  return typeof raw === "string" && (STAFF_ROLES as readonly string[]).includes(raw) ? (raw as StaffRole) : "shareholder";
}

export const isStaff = (r: Role | undefined | null): r is StaffRole => !!r && r !== "shareholder";

export function can(role: Role | undefined | null, p: Permission): boolean {
  return isStaff(role) && MATRIX[role].includes(p);
}

/** What each claim action needs. "owner" means the shareholder whose claim it is. */
export const ACTION_PERMISSION = {
  requestChase: "owner",
  resolveException: "owner",
  approve: "claims.approve",
  reject: "claims.approve",
  raiseException: "claims.approve",
  recordReceipt: "claims.work",
  sendChase: "claims.work",
  assign: "claims.work", // assigning to someone else additionally needs claims.assign
  recordCollection: "money.manage",
  requestDebit: "money.manage",
  failDebit: "money.manage",
  debitFee: "money.manage",
  waiveFee: "money.waive",
} as const satisfies Record<string, Permission | "owner">;

export type ActionType = keyof typeof ACTION_PERMISSION;
