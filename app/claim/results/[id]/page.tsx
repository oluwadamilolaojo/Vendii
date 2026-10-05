"use client";

import Link from "next/link";
import { ConfidenceTag } from "@/components/StatusTag";
import { Warrant } from "@/components/Warrant";
import { WizardShell } from "@/components/WizardShell";
import { useDraft } from "@/lib/draft";
import { feeFor, naira, netFor } from "@/lib/domain/fees";

export default function CandidateDetail({ params }: { params: { id: string } }) {
  const { draft, update } = useDraft();
  const c = draft.candidates.find((x) => x.id === params.id);

  if (!c) {
    return (
      <WizardShell phase={1} stepLabel="Details" backHref="/claim/results">
        <h1>We can&apos;t find that result</h1>
        <p>It may be from an earlier search.</p>
        <Link className="btn" href="/claim/results">Back to results</Link>
      </WizardShell>
    );
  }

  const on = draft.selectedIds.includes(c.id);
  const held = c.pocket === "uftf";
  const toggle = () =>
    update((d) => ({ selectedIds: on ? d.selectedIds.filter((x) => x !== c.id) : [...d.selectedIds, c.id] }));

  return (
    <WizardShell phase={1} stepLabel="Details" backHref="/claim/results"
      footer={held ? (
        <Link className="btn ghost lg" href="/claim/results">Back to results</Link>
      ) : (
        <div className="btn-row">
          <button className={on ? "btn ghost lg" : "btn lg"} onClick={toggle}>{on ? "Leave this one out" : "Include in my claim"}</button>
          <Link className="link" href="/claim/results">Back to results</Link>
        </div>
      )}>
      <div className="tags" style={{ marginBottom: 10 }}>
        <ConfidenceTag confidence={c.confidence} />
        {held && <span className="tag gold">On hold</span>}
      </div>
      <h1>{c.company}</h1>
      <p>Held with {c.registrar}{c.ticker ? `, ticker ${c.ticker}` : ""}.</p>
      <div style={{ marginBottom: 22 }}>
        <Warrant label="Estimated amount owed" amount={c.amount} stub={[`${c.units.toLocaleString("en-NG")} units`, c.years]} />
      </div>
      <h2>How we matched it</h2>
      <p>The register lists the holder as <b>&ldquo;{c.matchedOn}&rdquo;</b>. {c.matchNote}</p>
      {!held && (
        <>
          <h2>If it&apos;s paid in full</h2>
          <div className="ledger card" style={{ padding: "4px 18px" }}>
            <div className="row"><span className="k">Paid by {c.registrar}</span><span className="v">{naira(c.amount)}</span></div>
            <div className="row"><span className="k">Dividendi fee, 10%, debited after payment</span><span className="v">{naira(feeFor(c.amount))}</span></div>
            <div className="row total"><span>You keep</span><span>{naira(netFor(c.amount))}</span></div>
          </div>
        </>
      )}
    </WizardShell>
  );
}
