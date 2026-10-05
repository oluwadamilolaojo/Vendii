import type { ClaimEvent } from "@/lib/domain/types";
import { TickIcon } from "./icons";

export function Timeline({ events }: { events: ClaimEvent[] }) {
  return (
    <ol className="rail" style={{ listStyle: "none", margin: 0 }}>
      {events.map((e) => (
        <li key={e.id} className="node" data-s={e.state}>
          <span className="pip">{e.state === "done" && <TickIcon size={11} />}</span>
          <div className="t">{e.title}</div>
          <div className="d">{e.dateLabel}</div>
          {e.note && <div className="n">{e.note}</div>}
        </li>
      ))}
    </ol>
  );
}
