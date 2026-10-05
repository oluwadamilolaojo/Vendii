import { dueLabel, slaState } from "@/lib/domain/sla";
import type { Claim } from "@/lib/domain/types";

export function SlaPill({ c, now }: { c: Pick<Claim, "dueAt">; now?: Date }) {
  const s = slaState(c, now);
  if (s === "none") return <span className="sla none">No deadline</span>;
  return <span className={`sla ${s}`} title={c.dueAt ? new Date(c.dueAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos" }) : undefined}>{dueLabel(c, now)}</span>;
}
