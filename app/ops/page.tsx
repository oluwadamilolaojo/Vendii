"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusTag } from "@/components/StatusTag";
import { repo } from "@/lib/data";
import { feeFor, naira } from "@/lib/domain/fees";
import type { Claim, ClaimStatus } from "@/lib/domain/types";
import { errorMessage } from "@/lib/util";

/** Work queue order: what needs a person first, closed claims last. */
const PRIORITY: Record<ClaimStatus, number> = {
  review: 0, collected: 1, submitted: 2, chasing: 3, exception: 4, hold: 5, draft: 6, paid: 7, rejected: 8,
};

type Pending = { id: string; kind: "receipt" | "exception" | "reject"; value: string } | null;

export default function OpsConsole() {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");

  useEffect(() => {
    repo.ops.listAll().then(setClaims).catch((e) => setError(errorMessage(e)));
  }, []);

  const sorted = useMemo(() => {
    const list = (claims ?? []).filter((c) => filter === "all" || !["paid", "rejected"].includes(c.status));
    return [...list].sort((a, b) => Number(b.chaseRequested) - Number(a.chaseRequested) || PRIORITY[a.status] - PRIORITY[b.status]);
  }, [claims, filter]);

  async function act(id: string, fn: () => Promise<Claim>) {
    setBusyId(id);
    setError(null);
    try {
      const updated = await fn();
      setClaims((cs) => cs?.map((c) => (c.id === id ? updated : c)) ?? null);
      setPending(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!claims && !error) return <div className="center-note"><span className="spin" /></div>;

  const all = claims ?? [];
  const count = (s: ClaimStatus) => all.filter((c) => c.status === s).length;
  const fees = all.filter((c) => c.status === "paid").reduce((s, c) => s + feeFor(c.amount), 0);

  const submitPending = () => {
    if (!pending || !pending.value.trim()) return;
    const v = pending.value.trim();
    const { id, kind } = pending;
    void act(id, () => kind === "receipt" ? repo.ops.recordReceipt(id, v) : kind === "exception" ? repo.ops.raiseException(id, v) : repo.ops.reject(id, v));
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ops console</h1>
          <p style={{ marginBottom: 0 }}>Every claim ends paid, rejected with a written reason, or on a named exception. Nothing sits silent.</p>
        </div>
        <div className="segmented" role="group" aria-label="Filter">
          <button aria-pressed={filter === "open"} onClick={() => setFilter("open")}>Open</button>
          <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat-card"><div className="k">{count("review")}</div><div className="v">Awaiting review</div></div>
        <div className="stat-card"><div className="k">{count("submitted") + count("chasing")}</div><div className="v">With registrars</div></div>
        <div className="stat-card"><div className="k">{count("exception")}</div><div className="v">Waiting on shareholder</div></div>
        <div className="stat-card"><div className="k">{count("collected")}</div><div className="v">Fee to debit</div></div>
        <div className="stat-card"><div className="k">{naira(fees)}</div><div className="v">Fees collected</div></div>
      </div>

      {error && <div className="banner red"><b>That action failed</b>{error}</div>}

      {sorted.length === 0 ? (
        <div className="empty"><h2>Queue is clear</h2><p>No open claims right now.</p></div>
      ) : (
        <div className="stack">
          {sorted.map((c) => {
            const busy = busyId === c.id;
            const pend = pending?.id === c.id ? pending : null;
            return (
              <div key={c.id} className="card">
                <div className="row-between">
                  <div>
                    <div className="tags" style={{ marginBottom: 8 }}>
                      <StatusTag status={c.status} />
                      {c.chaseRequested && <span className="tag red">Shareholder asked for a check-in</span>}
                      {c.confidence !== "high" && c.status === "review" && <span className="tag gold">{c.confidence} confidence match</span>}
                    </div>
                    <h3 style={{ marginBottom: 2 }}>{c.company}, {c.ownerName}</h3>
                    <div className="tiny">{c.registrar}{c.ref ? `, ref ${c.ref}` : ""}. Register name &ldquo;{c.matchedOn}&rdquo;</div>
                  </div>
                  <div className="amount">{naira(c.amount)}</div>
                </div>

                <div className="btn-row" style={{ marginTop: 14 }}>
                  <Link className="btn quiet sm" href={`/ops/claims/${c.id}`}>{c.status === "review" ? "Review pack" : "Open"}</Link>
                  {c.status === "review" && <button className="btn sm" disabled={busy} onClick={() => act(c.id, () => repo.ops.approve(c.id))}>Approve and file</button>}
                  {c.status === "submitted" && <button className="btn sm" disabled={busy} onClick={() => setPending({ id: c.id, kind: "receipt", value: "" })}>Record receipt</button>}
                  {(c.status === "submitted" || c.status === "chasing") && <Link className="btn ghost sm" href={`/ops/claims/${c.id}#chase`}>Write chase</Link>}
                  {c.status === "chasing" && <button className="btn gold sm" disabled={busy} onClick={() => act(c.id, () => repo.ops.recordCollection(c.id))}>Registrar paid</button>}
                  {c.status === "collected" && <button className="btn gold sm" disabled={busy} onClick={() => act(c.id, () => repo.ops.debitFee(c.id))}>Debit {naira(feeFor(c.amount))} fee</button>}
                  {["review", "submitted", "chasing"].includes(c.status) && (
                    <button className="btn ghost sm" disabled={busy} onClick={() => setPending({ id: c.id, kind: "exception", value: "Name mismatch" })}>Raise exception</button>
                  )}
                  {["review", "submitted", "chasing", "exception", "hold"].includes(c.status) && (
                    <button className="btn danger sm" disabled={busy} onClick={() => setPending({ id: c.id, kind: "reject", value: "" })}>Record rejection</button>
                  )}
                  {busy && <span className="spin" />}
                </div>

                {pend && (
                  <div className="variant-row" style={{ marginTop: 12 }}>
                    <input className="input" autoFocus value={pend.value}
                      placeholder={pend.kind === "receipt" ? "Registrar reference, e.g. CR/UD/26-1043" : pend.kind === "exception" ? "What's needed from the shareholder" : "Written reason from the registrar"}
                      onChange={(e) => setPending({ ...pend, value: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && submitPending()} aria-label="Detail" />
                    <button className="btn sm" disabled={!pend.value.trim() || busy} onClick={submitPending}>Save</button>
                    <button className="btn ghost sm" onClick={() => setPending(null)}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
