import { STAFF_STATUS_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/domain/claimStatus";
import type { ClaimStatus, Confidence } from "@/lib/domain/types";

/** `staff` switches to the admin wording ("Waiting on shareholder" rather than "Needs you"). */
export function StatusTag({ status, staff = false }: { status: ClaimStatus; staff?: boolean }) {
  const tone = STATUS_TONE[status];
  return <span className={tone === "plain" ? "tag" : `tag ${tone}`}>{(staff ? STAFF_STATUS_LABEL : STATUS_LABEL)[status]}</span>;
}

export function ConfidenceTag({ confidence }: { confidence: Confidence }) {
  if (confidence === "high") return <span className="tag teal">Confirmed match</span>;
  if (confidence === "medium") return <span className="tag gold">Likely match</span>;
  return <span className="tag">Possible match</span>;
}
