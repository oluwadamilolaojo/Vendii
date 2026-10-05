import type { ClaimAction } from "./actions";
import { ACTION_PERMISSION, can, isStaff, type Permission } from "./permissions";
import type { Actor, Claim } from "./types";

import { PermissionError } from "./errors";

export { PermissionError };

export function requirePermission(actor: Actor | null | undefined, p: Permission): asserts actor is Actor {
  if (!actor || !isStaff(actor.role)) throw new PermissionError("Only Vendii staff can do that.");
  if (!can(actor.role, p)) throw new PermissionError("Your role doesn't allow that. Ask an admin.");
}

/** The one place that decides whether this person may run this action on this claim. */
export function authorizeAction(actor: Actor, c: Claim, a: ClaimAction): void {
  const need = ACTION_PERMISSION[a.type];
  if (need === "owner") {
    if (c.ownerId !== actor.id) throw new PermissionError("That claim isn't yours.");
    return;
  }
  requirePermission(actor, need);
  if (a.type === "assign" && !can(actor.role, "claims.assign")) {
    const toSelf = a.assignee?.id === actor.id;
    const unassignSelf = !a.assignee && c.assigneeId === actor.id;
    const takingOthers = c.assigneeId && c.assigneeId !== actor.id;
    if (!(toSelf || unassignSelf) || takingOthers) {
      throw new PermissionError("You can take unassigned claims or let go of your own. A reviewer assigns everything else.");
    }
  }
}
