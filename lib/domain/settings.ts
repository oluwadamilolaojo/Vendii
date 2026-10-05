import { DEFAULT_SLA } from "./sla";
import type { Settings, SlaPolicy } from "./types";

export const DEFAULT_SETTINGS: Settings = { sla: DEFAULT_SLA };

export const SLA_LABEL: Record<keyof SlaPolicy, string> = {
  review: "Pack review",
  submitted: "Registrar receipt",
  chasing: "Between status checks",
  exception: "Waiting on the shareholder",
  collected: "Fee debit after payment",
  escalateAfter: "Escalate after chasing for",
};

/** Whole working days, 1 to 60. Anything else is refused rather than silently clamped. */
export function validateSettings(input: unknown): Settings {
  const sla = (input as Settings | null)?.sla;
  if (!sla || typeof sla !== "object") throw new Error("Settings need an SLA policy.");
  const out = {} as SlaPolicy;
  for (const k of Object.keys(DEFAULT_SLA) as (keyof SlaPolicy)[]) {
    const v = Number((sla as unknown as Record<string, unknown>)[k]);
    if (!Number.isInteger(v) || v < 1 || v > 60) throw new Error(`${SLA_LABEL[k]} must be a whole number of working days from 1 to 60.`);
    out[k] = v;
  }
  if (out.escalateAfter <= out.chasing) throw new Error("Escalation has to come after at least one full chase interval.");
  return { sla: out };
}

export const mergeSettings = (saved: Partial<Settings> | null | undefined): Settings => ({ sla: { ...DEFAULT_SLA, ...(saved?.sla ?? {}) } });
