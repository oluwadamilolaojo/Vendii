"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusTag } from "@/components/StatusTag";
import { Timeline } from "@/components/Timeline";
import { BackIcon } from "@/components/icons";
import { repo } from "@/lib/data";
import { feeFor, naira, netFor } from "@/lib/domain/fees";
import type { Claim } from "@/lib/domain/types";
import { errorMessage } from "@/lib/util";

export default function ClaimDetail({ params }: { params: { id: string } }) {
  const [claim, setClaim] = useState<Claim | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    repo.getClaim(params.id).then(setClaim).catch((e) => setError(errorMessage(e)));
  }, [params.id]);

  async function act(fn: () => Promise<Claim>) {
    setBusy(true);
    setError(null);
    try {
      setClaim(await fn());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (claim === undefined && !error) return <div className="center-note"><span className="spin" /></div>;
  if (!claim) {
    return (
      <div className="empty">
        <h2>We can&apos;t find that claim</h2>
        <p>{error ?? "It may belong to a different account."}</p>
        <Link className="btn" href="/dashboard">Back to my claims</Link>
      </div>
    );
  }

  const c = claim;
  const canChase = (c.status === "submitted" || c.status === "chasing") && !c.chaseRequested;

  return (
    <>
      <Link className="backlink" href="/dashboard" style={{ marginBottom: 18 }}><BackIcon />All claims</Link>
      <div className="page-head" style={{ marginTop: 12 }}>
        <div>
          <div className="tags" style={{ marginBottom: 8 }}><StatusTag status={c.status} /></div>
          <h1>{c.company}</h1>
          <p style={{ marginBottom: 0 }}>{c.registrar}{c.ref ? `, reference ${c.ref}` : ""}</p>
        </div>
        <div className="amount" style={{ fontSize: 28 }}>{naira(c.amount)}</div>
      </div>

      {error && <div className="banner red"><b>That didn&apos;t work</b>{error}</div>}

      {c.status === "exception" && (
        <div className="banner red">
          <b>{c.exceptionReason ?? "We need something from you"}</b>
          The register spelling doesn&apos;t match your ID closely enough for the registrar. We&apos;ve drafted an affidavit of name variation tied to your NIN. Swear it at any High Court registry, then confirm here and we resubmit.
          <div style={{ marginTop: 12 }}>
            <button className="btn sm" disabled={busy} onClick={() => act(() => repo.resolveException(c.id))}>I&apos;ve sworn the affidavit</button>
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <h2>Timeline</h2>
          <Timeline events={c.events} />
          {canChase && (
            <div className="btn-row" style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
              <button className="btn ghost sm" disabled={busy} onClick={() => act(() => repo.requestChase(c.id))}>Ask for a status check</button>
              <span className="tiny">We contact {c.registrar} and post the answer here.</span>
            </div>
          )}
          {c.chaseRequested && <p className="tiny" style={{ marginTop: 12 }}>Status check requested. We&apos;ll post the registrar&apos;s answer here.</p>}
        </div>
        <aside className="stack">
          <div className="card ledger">
            <h3>{c.status === "paid" ? "What you received" : "If paid as estimated"}</h3>
            <div className="row"><span className="k">Paid by registrar</span><span className="v">{naira(c.amount)}</span></div>
            <div className="row"><span className="k">Vendii fee, 10%</span><span className="v">{c.status === "rejected" ? naira(0) : naira(feeFor(c.amount))}</span></div>
            <div className="row total"><span>You keep</span><span>{c.status === "rejected" ? naira(0) : naira(netFor(c.amount))}</span></div>
          </div>
          <div className="card ledger">
            <h3>The holding</h3>
            <div className="row"><span className="k">Units</span><span className="v">{c.units.toLocaleString("en-NG")}</span></div>
            <div className="row"><span className="k">Dividend years</span><span className="v">{c.years}</span></div>
            <div className="row"><span className="k">Register name</span><span className="v">{c.matchedOn}</span></div>
            {c.submittedOn && <div className="row"><span className="k">Filed</span><span className="v">{c.submittedOn}</span></div>}
            {c.paidOn && <div className="row"><span className="k">Closed</span><span className="v">{c.paidOn}</span></div>}
          </div>
        </aside>
      </div>
    </>
  );
}
