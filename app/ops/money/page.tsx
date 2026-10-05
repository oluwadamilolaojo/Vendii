"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { naira } from "@/lib/domain/fees";
import { BUCKET_LABEL, bucketOf, feeState, ledgerCsv, moneySummary, readStatement, reconcile, type MoneyBucket, type Reconciliation } from "@/lib/domain/money";
import { can } from "@/lib/domain/permissions";
import type { Claim } from "@/lib/domain/types";
import { useOps } from "@/lib/ops/context";
import { errorMessage } from "@/lib/util";

const BUCKETS: MoneyBucket[] = ["toRequest", "inFlight", "failed", "collected", "waived"];
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }) : "");

function Room() {
  const { me, claims, act, bulk } = useOps();
  const [tab, setTab] = useState<MoneyBucket>("toRequest");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ask, setAsk] = useState<{ id: string; kind: "fail" | "waive"; value: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: string; errors: string[] } | null>(null);
  const [recon, setRecon] = useState<{ r: Reconciliation; file: string } | null>(null);
  const [reconErr, setReconErr] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const rows = useMemo(() => (claims ?? []).filter((c) => bucketOf(c) !== null), [claims]);
  const sum = useMemo(() => moneySummary(rows, now), [rows, now]);
  const inTab = rows.filter((c) => bucketOf(c) === tab).sort((a, b) => (feeState(a)!.nextRetryAt ?? a.stateSince ?? "").localeCompare(feeState(b)!.nextRetryAt ?? b.stateSince ?? ""));
  const count = (b: MoneyBucket) => rows.filter((c) => bucketOf(c) === b).length;
  const mineToApprove = (c: Claim) => !!me && c.approvedBy === me.id;
  const selectable = (c: Claim) => (tab === "toRequest" || tab === "failed") && !mineToApprove(c);
  const selected = inTab.filter((c) => sel.has(c.id));

  async function one(c: Claim, a: Parameters<typeof act>[1]) {
    setBusy(c.id); setNote(null);
    try { await act(c.id, a); setAsk(null); }
    catch (e) { setNote({ ok: "", errors: [`${c.company}: ${errorMessage(e)}`] }); }
    finally { setBusy(null); }
  }

  async function requestSelected() {
    setBusy("bulk"); setNote(null);
    try {
      const r = await bulk(selected.map((c) => c.id), { type: "requestDebit" });
      setNote({ ok: `${r.done} debit${r.done === 1 ? "" : "s"} requested.`, errors: r.failed.map((f) => `${rows.find((c) => c.id === f.id)?.company ?? f.id}: ${f.error}`) });
      setSel(new Set());
    } catch (e) { setNote({ ok: "", errors: [errorMessage(e)] }); }
    finally { setBusy(null); }
  }

  async function onStatement(f: File) {
    setReconErr(null); setRecon(null);
    const { lines, error } = readStatement(await f.text());
    if (error) { setReconErr(error); return; }
    setRecon({ r: reconcile(rows, lines), file: f.name });
  }

  function exportLedger() {
    const blob = new Blob([ledgerCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `vendii-fee-ledger-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  if (!claims) return <div className="center-note"><span className="spin" /></div>;
  const canWaive = can(me?.role, "money.waive");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Money</h1>
          <p style={{ marginBottom: 0 }}>Registrars pay shareholders directly. This room tracks the 10% fee from the moment they do until it&apos;s on our statement.</p>
        </div>
        <button className="btn ghost sm" onClick={exportLedger}>Export fee ledger</button>
      </div>

      <div className="stats">
        <div className="stat-card"><div className="k">{naira(sum.feesCollected)}</div><div className="v">Fees collected</div></div>
        <div className="stat-card"><div className="k">{naira(sum.feesOutstanding)}</div><div className="v">Fees outstanding</div></div>
        <div className="stat-card"><div className="k" style={{ color: sum.failedCount ? "var(--red)" : undefined }}>{sum.failedCount}</div><div className="v">Failed debits{sum.retryDueCount ? `, ${sum.retryDueCount} due for retry` : ""}</div></div>
        <div className="stat-card"><div className="k">{naira(sum.feesWaived)}</div><div className="v">Waived</div></div>
        <div className="stat-card"><div className="k">{naira(sum.netToShareholders)}</div><div className="v">Net to shareholders</div></div>
      </div>

      <div className="tabs" role="tablist">
        {BUCKETS.map((b) => (
          <button key={b} className="tab" role="tab" aria-selected={tab === b} onClick={() => { setTab(b); setSel(new Set()); setAsk(null); }}>
            {BUCKET_LABEL[b]} {count(b)}
          </button>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="bulkbar">
          <b>{selected.length} selected</b>
          <button className="btn gold sm" disabled={busy === "bulk"} onClick={requestSelected}>Request {selected.length} debit{selected.length === 1 ? "" : "s"} ({naira(selected.reduce((s, c) => s + feeState(c)!.amount, 0))})</button>
          <button className="btn quiet sm" onClick={() => setSel(new Set())}>Clear</button>
          {busy === "bulk" && <span className="spin" />}
        </div>
      )}
      {note && <div className={`banner ${note.errors.length ? "gold" : "navy"}`}>{note.ok && <b>{note.ok}</b>}{note.errors.map((e, i) => <div key={i}>{e}</div>)}</div>}

      {inTab.length === 0 ? (
        <div className="empty"><h2>Nothing here</h2><p>{tab === "failed" ? "No failed debits." : tab === "toRequest" ? "No fees waiting to be debited." : "No fees in this state."}</p></div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {(tab === "toRequest" || tab === "failed") && <th style={{ width: 34 }} />}
                <th>Claim</th><th className="num">Recovered</th><th className="num">Fee</th><th>Reference</th>
                <th>{tab === "failed" ? "Last error" : tab === "collected" || tab === "waived" ? "Settled" : tab === "inFlight" ? "Requested" : "Registrar paid"}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {inTab.map((c) => {
                const f = feeState(c)!;
                const retryDue = f.status === "failed" && f.nextRetryAt && new Date(f.nextRetryAt) <= now;
                const asking = ask?.id === c.id ? ask : null;
                return (
                  <tr key={c.id} className={sel.has(c.id) ? "sel" : undefined}>
                    {(tab === "toRequest" || tab === "failed") && (
                      <td>{selectable(c) && <input type="checkbox" aria-label={`Select ${c.company}`} checked={sel.has(c.id)} onChange={() => setSel((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} />}</td>
                    )}
                    <td><Link href={`/ops/claims/${c.id}`}>{c.ownerName}</Link><div className="sub">{c.company} · {c.registrar}</div></td>
                    <td className="num">{naira(c.amount)}</td>
                    <td className="num">{naira(f.amount)}</td>
                    <td><code style={{ fontSize: 12 }}>{f.reference}</code>{f.attempts > 1 && <div className="sub">{f.attempts} attempts</div>}</td>
                    <td>
                      {tab === "failed" && <>{f.lastError}<div className="sub" style={{ color: retryDue ? "var(--red)" : undefined }}>{retryDue ? "Retry due now" : `Retry from ${day(f.nextRetryAt)}`}</div></>}
                      {tab === "inFlight" && day(f.requestedAt)}
                      {tab === "toRequest" && day(c.stateSince ?? null)}
                      {(tab === "collected" || tab === "waived") && <>{day(f.settledAt) || "Before fee tracking"}{f.waivedReason && <div className="sub">{f.waivedReason}</div>}</>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {mineToApprove(c) && (tab === "toRequest" || tab === "failed" || tab === "inFlight") ? (
                        <span className="tiny">You approved this one</span>
                      ) : asking ? (
                        <div className="variant-row">
                          <input className="input" style={{ minWidth: 180 }} autoFocus value={asking.value} placeholder={asking.kind === "fail" ? "Why it failed" : "Why waive"}
                            onChange={(e) => setAsk({ ...asking, value: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && asking.value.trim() && one(c, asking.kind === "fail" ? { type: "failDebit", reason: asking.value } : { type: "waiveFee", reason: asking.value })} />
                          <button className="btn sm" disabled={!asking.value.trim() || busy === c.id} onClick={() => one(c, asking.kind === "fail" ? { type: "failDebit", reason: asking.value } : { type: "waiveFee", reason: asking.value })}>Save</button>
                          <button className="btn ghost sm" onClick={() => setAsk(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="btn-row">
                          {(tab === "toRequest" || tab === "failed") && <button className="btn gold sm" disabled={busy === c.id} onClick={() => one(c, { type: "requestDebit" })}>{tab === "failed" ? "Retry" : "Request debit"}</button>}
                          {(tab === "toRequest" || tab === "inFlight") && <button className="btn sm" disabled={busy === c.id} onClick={() => one(c, { type: "debitFee" })}>Received</button>}
                          {tab === "inFlight" && <button className="btn ghost sm" disabled={busy === c.id} onClick={() => setAsk({ id: c.id, kind: "fail", value: "" })}>Failed</button>}
                          {canWaive && tab !== "collected" && tab !== "waived" && <button className="btn ghost sm" disabled={busy === c.id} onClick={() => setAsk({ id: c.id, kind: "waive", value: "" })}>Waive</button>}
                          {busy === c.id && <span className="spin" />}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: 28 }}>
        <h2>Reconcile against the bank statement</h2>
        <p className="tiny">Export the fee account&apos;s statement as CSV and drop it here. Each credit is matched to a fee by its VND reference, or by exact amount when the bank dropped the reference. Nothing leaves this browser.</p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onStatement(e.target.files[0])} />
        {reconErr && <div className="field-error" style={{ marginTop: 8 }}>{reconErr}</div>}
        {recon && (
          <>
            <div className="recon-head"><h3 style={{ color: recon.r.missingFromStatement.length ? "var(--red)" : undefined }}>Marked collected, not on the statement: {recon.r.missingFromStatement.length}</h3></div>
            {recon.r.missingFromStatement.length === 0 ? <p className="tiny">Every fee marked collected is on the statement.</p> : (
              <p className="tiny">These are recorded as collected but no money arrived. Check each one with the bank before trusting the totals above.</p>
            )}
            {recon.r.missingFromStatement.map((c) => <div key={c.id} className="req-row"><span><Link href={`/ops/claims/${c.id}`}>{c.ownerName}</Link>, {c.company}</span><span><code>{feeState(c)!.reference}</code> {naira(feeState(c)!.amount)}</span></div>)}

            <div className="recon-head"><h3>Wrong amount: {recon.r.amountMismatch.length}</h3></div>
            {recon.r.amountMismatch.map((m) => <div key={m.claim.id} className="req-row"><span>Row {m.line.row}: {m.line.narration}</span><span>expected {naira(feeState(m.claim)!.amount)}, got {naira(m.line.amount)}</span></div>)}

            <div className="recon-head"><h3>Matched: {recon.r.matched.length}</h3><span className="tiny">{recon.r.matched.filter((m) => m.how === "amount").length} by amount only</span></div>
            {recon.r.matched.filter((m) => m.how === "amount").map((m) => <div key={m.claim.id} className="req-row"><span>Row {m.line.row}: {m.line.narration}</span><span>{m.claim.ownerName}, {naira(m.line.amount)} (check)</span></div>)}

            <div className="recon-head"><h3>Credits we can&apos;t place: {recon.r.unknownCredits.length}</h3></div>
            {recon.r.unknownCredits.slice(0, 20).map((l) => <div key={l.row} className="req-row"><span>Row {l.row}: {l.narration}</span><span>{naira(l.amount)}</span></div>)}
          </>
        )}
      </div>
    </>
  );
}

export default function MoneyRoom() {
  return <RequireAuth permission="money.manage"><Room /></RequireAuth>;
}
