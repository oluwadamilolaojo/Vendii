import type { FormsReport } from "@/lib/forms/profile";

/** What the filler did, per registrar: what it ticked and what still needs a pen. */
export function FormsReportView({ report }: { report: FormsReport }) {
  return (
    <div className="stack" style={{ gap: 10, marginTop: 12 }}>
      {report.forms.map((f) => (
        <div key={f.registrarId} className="tiny">
          <b>{f.registrar}</b>
          {f.ticked.length > 0 && <div>Ticked: {f.ticked.join(", ")}</div>}
          {f.warnings.map((w, i) => <div key={i} style={{ color: "var(--red, #b3261e)" }}>{w.message}</div>)}
        </div>
      ))}
      {!!report.unmapped?.length && (
        <div className="tiny" style={{ color: "var(--red, #b3261e)" }}>
          No form mapped for: {report.unmapped.join(", ")}. File these by hand.
        </div>
      )}
    </div>
  );
}
