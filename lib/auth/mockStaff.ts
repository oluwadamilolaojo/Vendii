import "@/lib/storageMigration";
import { OPS_EMAILS } from "@/lib/config";
import type { StaffMember, StaffRole } from "@/lib/domain/types";

/**
 * Mock mode's staff directory. One demo person per role so every view of the admin portal can be
 * tried, plus any address in NEXT_PUBLIC_OPS_EMAILS as admin. Changes made on the Team page are
 * kept in this browser. On Firebase the same list lives in the `staff` collection.
 */
const KEY = "vendii:v1:staff";

export const DEMO_STAFF: StaffMember[] = [
  { id: "mock-staff-admin", name: "Damilola Ojo", identifier: "ops@vendii.ng", role: "admin", active: true },
  { id: "mock-staff-reviewer", name: "Ngozi Eze", identifier: "reviewer@vendii.ng", role: "reviewer", active: true },
  { id: "mock-staff-agent", name: "Tobi Adeyemi", identifier: "agent@vendii.ng", role: "agent", active: true },
  { id: "mock-staff-finance", name: "Chidi Okafor", identifier: "finance@vendii.ng", role: "finance", active: true },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");

export function readMockStaff(): StaffMember[] {
  let saved: StaffMember[] | null = null;
  if (typeof window !== "undefined") {
    try { saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null"); } catch { saved = null; }
  }
  const list = saved ?? DEMO_STAFF;
  // Env-configured ops addresses are always admins, even if the directory was edited.
  for (const e of OPS_EMAILS) {
    if (!list.some((m) => norm(m.identifier) === norm(e))) list.push({ id: "mock-staff-" + norm(e), name: e.split("@")[0], identifier: e, role: "admin", active: true });
  }
  return list;
}

export function writeMockStaff(list: StaffMember[]) {
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function findMockStaff(identifier: string): StaffMember | null {
  return readMockStaff().find((m) => m.active && norm(m.identifier) === norm(identifier)) ?? null;
}

export function setMockRole(identifier: string, name: string, role: StaffRole | null): StaffMember | null {
  const list = readMockStaff();
  const i = list.findIndex((m) => norm(m.identifier) === norm(identifier));
  if (role === null) {
    if (i >= 0) list[i] = { ...list[i], active: false };
    writeMockStaff(list);
    return i >= 0 ? list[i] : null;
  }
  const member: StaffMember = i >= 0
    ? { ...list[i], role, active: true, name: name.trim() || list[i].name }
    : { id: "mock-staff-" + norm(identifier).replace(/\W/g, ""), name: name.trim() || identifier, identifier: identifier.trim(), role, active: true };
  if (i >= 0) list[i] = member; else list.push(member);
  writeMockStaff(list);
  return member;
}
