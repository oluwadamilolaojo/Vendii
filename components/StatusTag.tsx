import { STATUS_LABEL, STATUS_TONE } from "@/lib/domain/claimStatus";
import type { ClaimStatus, Confidence } from "@/lib/domain/types";

export function StatusTag({ status }: { status: ClaimStatus }) {
  const tone = STATUS_TONE[status];
  return <span className={tone === "plain" ? "tag" : `tag ${tone}`}>{STATUS_LABEL[status]}</span>;
}

export function ConfidenceTag({ confidence }: { confidence: Confidence }) {
  if (confidence === "high") return <span className="tag teal">Confirmed match</span>;
  if (confidence === "medium") return <span className="tag gold">Likely match</span>;
  return <span className="tag">Possible match</span>;
}
