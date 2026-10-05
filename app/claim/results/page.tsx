"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfidenceTag } from "@/components/StatusTag";
import { Warrant } from "@/components/Warrant";
import { WizardShell } from "@/components/WizardShell";
import { TickIcon } from "@/components/icons";
import { useDraft } from "@/lib/draft";
import { naira } from "@/lib/domain/fees";
import type { Claim } from "@/lib/domain/types";

export default function ResultsStep() {
  const { draft, update } = useDraft();
  const router = useRouter();
  const cands = draft.candidates;
  const reg = cands.filter((c) => c.pocket === "registrar");
  const held = cands.filter((c) => c.pocket === "uftf");
  const selected = reg.filter((c) => draft.selectedIds.includes(c.id));
  const total = cands.reduce((s, c) => s + c.amount, 0);
  const selectedTotal = selected.reduce((s, c) => s + c.amount, 0);
  const estate = draft.flowType === "estate";

  const toggle = (id: string) =>
    update((d) => ({ selectedIds: d.selectedIds.includes(id) ? d.selectedIds.filter((x) => x !== id) : [...d.selectedIds, id] }));

  if (cands.length === 0) {
    return (
      <WizardShell phase={1} stepLabel="Results" backHref="/claim/variants">
        <h1>Nothing found yet</h1>
        <p>No register matched the spellings we tried. That often means the name was recorded differently. Add more variants, like initials or a maiden name, and search again.</p>
        <div className="btn-row">
          <Link className="btn" href="/claim/variants">Add spellings</Link>
          <Link className="btn ghost" href="/claim/search">Search again</Link>
        </div>
      </WizardShell>
    );
  }

  const renderCard = (c: Claim) => {
    const on = draft.selectedIds.includes(c.id);
    return (
      <div key={c.id} className={on ? "card selected" : "card"}>
        <Link href={`/claim/results/${c.id}`} style={{ color: "inherit", textDecoration: "none", display: "block" }}>
          <div className="row-between">
            <div>
              <h3 style={{ marginBottom: 2 }}>{c.company}</h3>
              <div className="tiny">{c.registrar}</div>
            </div>
            <div className="amount">{naira(c.amount)}</div>
          </div>
          <div className="tiny" style={{ margin: "10px 0" }}>{c.units.toLocaleString("en-NG")} units, {c.years}. Matched on &ldquo;{c.matchedOn}&rdquo;</div>
        </Link>
        <div className="row-between" style={{ alignItems: "center" }}>
          <ConfidenceTag confidence={c.confidence} />
          <button className={on ? "btn sm" : "btn ghost sm"} onClick={() => toggle(c.id)} aria-pressed={on}>
            {on ? <><TickIcon />Included</> : "Include"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <WizardShell phase={1} stepLabel="Results" wide backHref="/claim/bank"
      footer={
        <div className="btn-row">
          <button className="btn gold lg" disabled={selected.length === 0} onClick={() => router.push("/claim/authorize")}>
            File {selected.length} claim{selected.length === 1 ? "" : "s"} for {naira(selectedTotal)}
          </button>
          <span className="tiny">Nothing is sent until you sign, and a person here reviews every pack before it goes out.</span>
        </div>
      }>
      <h1>{estate ? "Here's what the estate is owed" : "Here's what we found"}</h1>
      <p>These are estimates from register records. The registrar confirms the exact figure before paying.</p>
      <div style={{ marginBottom: 24 }}>
        <Warrant full countUp label="Estimated unclaimed dividends" amount={total}
          foot={`Across ${cands.length} companies and ${new Set(cands.map((c) => c.registrar)).size} registrars.`}
          stub={[`${reg.length} claimable now`, held.length ? `${held.length} on hold` : "None on hold"]} />
      </div>

      <h2>Claimable now</h2>
      <p className="tiny">Everything is included by default. Tap a company for the match details, or exclude any you&apos;re unsure of.</p>
      <div className="grid-2" style={{ marginBottom: 28 }}>
        {reg.map(renderCard)}
      </div>

      {held.length > 0 && (
        <>
          <h2>On hold</h2>
          <div className="banner gold">
            <b>Older than six years</b>
            These have moved outside the registrar&apos;s normal window. The trust fund meant to receive them isn&apos;t running yet, so we track them for you and file when there&apos;s a route. No fee until then.
          </div>
          <div className="grid-2">
            {held.map((c) => (
              <Link key={c.id} className="card" href={`/claim/results/${c.id}`}>
                <div className="row-between">
                  <div><h3 style={{ marginBottom: 2 }}>{c.company}</h3><div className="tiny">{c.registrar}</div></div>
                  <div className="amount muted-amount">{naira(c.amount)}</div>
                </div>
                <div className="tiny" style={{ marginTop: 10 }}>{c.years}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </WizardShell>
  );
}
