import type { FlowType } from "@/lib/domain/types";

export type IdentityStep = "name" | "variants" | "identity" | "authority" | "bank";

export function identitySteps(flow: FlowType): IdentityStep[] {
  return flow === "estate"
    ? ["name", "variants", "identity", "authority", "bank"]
    : ["name", "variants", "identity", "bank"];
}

export const stepHref = (s: IdentityStep) => `/claim/${s}`;

export function nextHref(flow: FlowType, s: IdentityStep): string {
  const steps = identitySteps(flow);
  const i = steps.indexOf(s);
  return i >= 0 && i < steps.length - 1 ? stepHref(steps[i + 1]) : "/claim/search";
}

export function prevHref(flow: FlowType, s: IdentityStep): string {
  const steps = identitySteps(flow);
  const i = steps.indexOf(s);
  return i > 0 ? stepHref(steps[i - 1]) : "/";
}

export function stepLabel(flow: FlowType, s: IdentityStep): string {
  const steps = identitySteps(flow);
  return `Step ${steps.indexOf(s) + 1} of ${steps.length}`;
}

/** Steps that work before sign-in. Everything else needs a verified phone or email. */
export const OPEN_CLAIM_PATHS = ["/claim/start", "/claim/name", "/claim/variants", "/claim/identity", "/claim/bank"];
