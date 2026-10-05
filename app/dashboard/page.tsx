"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusTag } from "@/components/StatusTag";
import { Warrant } from "@/components/Warrant";
import { repo } from "@/lib/data";
import { isActive, isClosed } from "@/lib/domain/claimStatus";
import { naira, netFor } from "@/lib/domain/fees";
import type { Claim } from "@/lib/domain/types";
import { errorMessage } from "@/lib/util";

type Tab = "active" | "closed" | "all";

export default function Dashboard() {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");

  useEffect(() => {
    repo.listMyClaims().then(setClaims).catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <div className="banner red"><b>We couldn&apos;t load your claims</b>{error}</div>;
  if (!claims) return <div className="center-note"><span className="spin" /></div>;

  if (claims.length === 0) {
    return (
      <div className="empty">
        <h2>No claims yet</h2>
        <p>Search every registrar for dividends in your name. It takes about five minutes, and you see what&apos;s owed before you commit.</p>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <Link className="btn gold" href="/claim/start/own">Check what you&apos;re owed</Link>
          <Link className="btn ghost" href="/claim/start/estate">Claim for an estate</Link>
        </div>
      </div>
    );
  }

  const paid = claims.filter((c) => c.status === "paid");
  const recovered = paid.reduce((s, c) => s + c.amount, 0);
  const inFlight = claims.filter((c) => isActive(c.status) && c.status !== "hold").reduce((s, c) => s + c.amount, 0);
  const needsYou = claims.filter((c) => c.status === "exception");
  const shown = claims.filter((c) => (tab === "all" ? true : tab === "closed" ? isClosed(c.status) : !isClosed(c.status)));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your claims</h1>
          <p style={{ marginBottom: 0 }}>{claims.length} claim{claims.length === 1 ? "" : "s"} across {new Set(claims.map((c) => c.registrar)).size} registrars.</p>
        </div>
        <Link className="btn ghost" href="/claim/start/own">Start another search</Link>
      </div>

      {needsYou.length > 0 && (
        <div className="banner red">
          <b>{needsYou.length === 1 ? "One claim needs you" : `${needsYou.length} claims need you`}</b>
          {needsYou.map((c) => (
            <span key={c.id}><Link className="link" href={`/dashboard/claims/${c.id}`}>{c.company}</Link>: {c.exceptionReason ?? "action needed"}. </span>
          ))}
        </div>
      )}

      <div className="two-col">
        <div>
          <div className="tabs" role="tablist">
            {(["active", "closed", "all"] as Tab[]).map((t) => (
              <button key={t} role="tab" className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {t === "active" ? "In progress" : t === "closed" ? "Closed" : "All"}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="tiny">Nothing here.</p>
          ) : (
            <div className="grid-2">
              {shown.map((c) => (
                <Link key={c.id} className="card" href={`/dashboard/claims/${c.id}`}>
                  <div className="row-between">
                    <div><h3 style={{ marginBottom: 2 }}>{c.company}</h3><div className="tiny">{c.registrar}</div></div>
                    <div className={c.status === "rejected" ? "amount muted-amount" : "amount"}>{naira(c.amount)}</div>
                  </div>
                  <div className="tags" style={{ marginTop: 12 }}>
                    <StatusTag status={c.status} />
                    {c.chaseRequested && <span className="tag">Check-in requested</span>}
                  </div>
                  <div className="tiny" style={{ marginTop: 10 }}>{c.events.filter((e) => e.state !== "wait").at(-1)?.title}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <aside className="stack">
          <Warrant label="Recovered so far" amount={recovered} full
            foot={paid.length ? `You kept ${naira(paid.reduce((s, c) => s + netFor(c.amount), 0))} after our 10%.` : "Nothing paid yet. Most claims take 6 to 10 weeks."}
            stub={["In flight", naira(inFlight)]} />
          <div className="card">
            <h3>How we chase</h3>
            <p className="tiny" style={{ marginBottom: 0 }}>
              We check with each registrar every two weeks. After four weeks without movement we escalate to a named contact there. Every claim ends paid, formally rejected with a written reason, or with a clear next step for you.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
