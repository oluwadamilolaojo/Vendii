"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
import { FormsReportView } from "@/components/FormsReport";
import { StatusTag } from "@/components/StatusTag";
import { Timeline } from "@/components/Timeline";
import { BackIcon } from "@/components/icons";
import { SlaPill } from "@/components/ops/Sla";
import { repo } from "@/lib/data";
import type { OpsAction } from "@/lib/domain/actions";
import { naira, netFor } from "@/lib/domain/fees";
import { buildChaseMessage } from "@/lib/domain/messages";
import { feeState } from "@/lib/domain/money";
import { fullName } from "@/lib/domain/names";
import { can } from "@/lib/domain/permissions";
import { claimRegistrarId } from "@/lib/domain/registrarDesk";
import { needsEscalation } from "@/lib/domain/sla";
import type { Claim, Filing, OutboundMessage, RegistrarProfile } from "@/lib/domain/types";
import { saveBlob } from "@/lib/forms/client";
import type { FormsReport } from "@/lib/forms/profile";
import { useOps } from "@/lib/ops/context";
import { errorMessage, maskTail } from "@/lib/util";

type Ask = { kind: "receipt" | "exception" | "reject" | "failDebit" | "waive"; value: string } | null;

const ASK_COPY: Record<NonNullable<Ask>["kind"], { label: string; placeholder: string; button: string }> = {
  receipt: { label: "Registrar reference", placeholder: "e.g. CR/UD/26-1043", button: "Record receipt" },
  exception: { label: "What's needed from the shareholder", placeholder: "e.g. Affidavit of name variation", button: "Raise exception" },
  reject: { label: "The registrar's written reason", placeholder: "Quote or summarise their letter", button: "Close as rejected" },
  failDebit: { label: "Why the debit failed", placeholder: "e.g. Insufficient funds", button: "Record failure" },
  waive: { label: "Why the fee is being waived", placeholder: "This is written to the audit log", button: "Waive fee" },
};

export default function OpsClaim({ params }: { params: { id: string } }) {
  const { me, staff, settings, act, replace } = useOps();
  const [claim, setClaim] = useState<Claim | null | undefined>(undefined);
  const [filing, setFiling] = useState<Filing | null>(null);
  const [showId, setShowId] = useState(false);
  const [reg, setReg] = useState<RegistrarProfile | null>(null);
  const [msg, setMsg] = useState<OutboundMessage | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<{ busy: boolean; report: FormsReport | null; error: string | null }>({ busy: false, report: null, error: null });

  useEffect(() => {
    (async () => {
      try {
        const c = await repo.getClaim(params.id);
        setClaim(c);
        if (c) {
          setMsg(buildChaseMessage(c));
          const regs = await repo.ops.registrars().catch(() => []);
          setReg(regs.find((r) => r.id === claimRegistrarId(c)) ?? null);
        }
      } catch (e) {
        setError(errorMessage(e));
        setClaim(null);
      }
    })();
  }, [params.id]);

  if (claim === undefined) return <div className="center-note"><span className="spin" /></div>;
  if (!claim) return <div className="empty"><h2>Claim not found</h2><p>{error}</p><Link className="btn" href="/ops">Back to queue</Link></div>;

  const c = claim;
  const role = me?.role;
  const fee = feeState(c);
  const iApproved = !!me && c.approvedBy === me.id;
  const open = !["paid", "rejected"].includes(c.status);

  async function run(action: OpsAction) {
    setBusy(true); setError(null);
    try {
      const updated = await act(c.id, action);
      setClaim(updated); replace(updated); setAsk(null);
      if (action.type === "sendChase") setMsg(buildChaseMessage(updated));
    } catch (e) {
      setError(errorMessage(e));
    } finally { setBusy(false); }
  }

  function submitAsk() {
    if (!ask?.value.trim()) return;
    const v = ask.value.trim();
    const a: OpsAction = ask.kind === "receipt" ? { type: "recordReceipt", ref: v }
      : ask.kind === "exception" ? { type: "raiseException", reason: v }
      : ask.kind === "reject" ? { type: "reject", reason: v }
      : ask.kind === "failDebit" ? { type: "failDebit", reason: v }
      : { type: "waiveFee", reason: v };
    void run(a);
  }

  async function loadId() {
    if (!c.filingId) return;
    setShowId(true);
    try { setFiling(await repo.ops.getFiling(c.filingId)); } catch (e) { setError(errorMessage(e)); }
  }

  async function downloadForms(filingId: string) {
    setForms({ busy: true, report: null, error: null });
    try {
      const r = await repo.ops.downloadForms(filingId);
      saveBlob(r.blob, r.filename);
      setForms({ busy: false, report: r.report, error: null });
    } catch (e) {
      setForms({ busy: false, report: null, error: errorMessage(e) });
    }
  }

  const Btn = ({ show, onClick, children, kind = "" }: { show: boolean; onClick: () => void; children: React.ReactNode; kind?: string }) =>
    show ? <button className={`btn sm ${kind}`} disabled={busy} onClick={onClick}>{children}</button> : null;

  const canWork = can(role, "claims.work"), canApprove = can(role, "claims.approve"), canMoney = can(role, "money.manage");
  const escalate = needsEscalation(c, settings.sla);

  return (
    <>
      <Link className="backlink" href="/ops"><BackIcon />Queue</Link>
      <div className="page-head" style={{ marginTop: 12 }}>
        <div>
          <div className="tags" style={{ marginBottom: 8 }}>
            <StatusTag staff status={c.status} />
            <SlaPill c={c} />
            {escalate && <span className="tag gold">Chasing past {settings.sla.escalateAfter} working days: escalate</span>}
          </div>
          <h1>{c.company}, {c.ownerName}</h1>
          <p style={{ marginBottom: 0 }}>{c.registrar}{c.ref ? `, ref ${c.ref}` : ""}. {c.units.toLocaleString("en-NG")} units, {c.years}.</p>
        </div>
        <div className="amount" style={{ fontSize: 28 }}>{naira(c.amount)}</div>
      </div>
      {error && <div className="banner red"><b>That didn&apos;t go through</b>{error}</div>}

      <div className="two-col">
        <div className="stack">
          {/* ---------------- what to do next ---------------- */}
          {open && (
            <div className="card">
              <h2>Next step</h2>
              {c.status === "review" && (
                <p className="tiny">Check that the register name &ldquo;{c.matchedOn}&rdquo; ties to the ID, the photo is clear, the signature is present and the bank account is in the {filing?.flowType === "estate" ? "administrator's" : "shareholder's"} name. {c.matchNote}</p>
              )}
              {c.status === "submitted" && <p className="tiny">Waiting for {c.registrar} to acknowledge the pack. Record their reference when it arrives, or chase at the deadline.</p>}
              {c.status === "chasing" && <p className="tiny">Status checks run on a {settings.sla.chasing}-working-day cycle. Each chase restarts the clock.</p>}
              {c.status === "exception" && <p className="tiny">Waiting on the shareholder: {c.exceptionReason}. They see this on their claim page.</p>}
              {c.status === "hold" && <p className="tiny">Older than six years. No route until the Unclaimed Funds Trust Fund is operational. No fee is charged meanwhile.</p>}
              {c.status === "collected" && <p className="tiny">The registrar has paid the shareholder. The fee is collected by NIBSS direct debit; the shareholder was told the exact amount first.</p>}

              {escalate && (
                <div className="banner gold" style={{ marginTop: 10 }}>
                  <b>Escalate to a named contact</b>
                  {reg?.contactName ? `${reg.contactName}${reg.phone ? `, ${reg.phone}` : ""}${reg.email ? `, ${reg.email}` : ""}.` : <>No named contact recorded for {c.registrar}. <Link href={`/ops/registrars/${claimRegistrarId(c)}`}>Add one on the registrar desk</Link>.</>}
                </div>
              )}

              <div className="btn-row" style={{ marginTop: 12 }}>
                <Btn show={canApprove && c.status === "review"} onClick={() => run({ type: "approve" })}>Approve and file</Btn>
                <Btn show={canWork && c.status === "submitted"} onClick={() => setAsk({ kind: "receipt", value: "" })}>Record receipt</Btn>
                <Btn show={canMoney && ["submitted", "chasing"].includes(c.status)} kind="gold" onClick={() => run({ type: "recordCollection" })}>Registrar paid the shareholder</Btn>
                <Btn show={canApprove && ["review", "submitted", "chasing"].includes(c.status)} kind="ghost" onClick={() => setAsk({ kind: "exception", value: "" })}>Raise exception</Btn>
                <Btn show={canApprove && ["review", "submitted", "chasing", "exception", "hold"].includes(c.status)} kind="danger" onClick={() => setAsk({ kind: "reject", value: "" })}>Record rejection</Btn>
                {busy && <span className="spin" />}
              </div>
              {!canWork && !canMoney && <p className="tiny" style={{ marginTop: 8 }}>Your role can view this claim but not change it.</p>}
            </div>
          )}

          {/* ---------------- the fee ---------------- */}
          {fee && (
            <div className="card">
              <h2>Fee</h2>
              <div className="ledger">
                <div className="row"><span className="k">Amount</span><span className="v">{naira(fee.amount)}, leaving the shareholder {naira(netFor(c.amount))}</span></div>
                <div className="row"><span className="k">Debit reference</span><span className="v">{fee.reference}</span></div>
                <div className="row"><span className="k">Status</span><span className="v">{fee.status === "none" ? "Not requested" : fee.status === "requested" ? "Debit in progress" : fee.status === "failed" ? `Failed: ${fee.lastError}` : fee.status === "collected" ? "Collected" : `Waived: ${fee.waivedReason}`}</span></div>
                {fee.attempts > 0 && <div className="row"><span className="k">Attempts</span><span className="v">{fee.attempts}</span></div>}
                {fee.nextRetryAt && <div className="row"><span className="k">Retry from</span><span className="v">{new Date(fee.nextRetryAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })}</span></div>}
              </div>
              {c.status === "collected" && (
                iApproved && (canMoney || can(role, "money.waive")) ? (
                  <div className="banner plain" style={{ marginTop: 12 }}><b>Someone else has to take this fee</b>You approved this claim. Separation of duties keeps approving and collecting money with different people.</div>
                ) : (
                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <Btn show={canMoney && ["none", "failed"].includes(fee.status)} kind="gold" onClick={() => run({ type: "requestDebit" })}>{fee.status === "failed" ? "Retry debit" : `Request ${naira(fee.amount)} debit`}</Btn>
                    <Btn show={canMoney && ["none", "requested"].includes(fee.status)} onClick={() => run({ type: "debitFee" })}>Record debit received</Btn>
                    <Btn show={canMoney && fee.status === "requested"} kind="ghost" onClick={() => setAsk({ kind: "failDebit", value: "" })}>Record failed debit</Btn>
                    <Btn show={can(role, "money.waive")} kind="ghost" onClick={() => setAsk({ kind: "waive", value: "" })}>Waive fee</Btn>
                  </div>
                )
              )}
            </div>
          )}

          {ask && (
            <div className="card">
              <label className="label" htmlFor="ask">{ASK_COPY[ask.kind].label}</label>
              <div className="variant-row" style={{ marginTop: 6 }}>
                <input id="ask" className="input" autoFocus value={ask.value} placeholder={ASK_COPY[ask.kind].placeholder}
                  onChange={(e) => setAsk({ ...ask, value: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submitAsk()} />
                <button className={`btn sm ${ask.kind === "reject" ? "danger" : ""}`} disabled={!ask.value.trim() || busy} onClick={submitAsk}>{ASK_COPY[ask.kind].button}</button>
                <button className="btn ghost sm" onClick={() => setAsk(null)}>Cancel</button>
              </div>
            </div>
          )}

          {canWork && ["submitted", "chasing"].includes(c.status) && msg && (
            <div className="card" id="chase">
              <h2>Chase message</h2>
              <p className="tiny">Drafted from the claim. Automatic sending isn&apos;t connected yet: copy the text, send it from the team inbox, then log it here so the deadline restarts.</p>
              <div className="mail-row"><span className="k">To</span><input className="input" value={msg.to} onChange={(e) => setMsg({ ...msg, to: e.target.value })} aria-label="To" /></div>
              <div className="mail-row"><span className="k">Subject</span><input className="input" value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} aria-label="Subject" /></div>
              <textarea className="input" style={{ marginTop: 12 }} value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} aria-label="Message body" />
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button className="btn" disabled={busy || !msg.to} onClick={() => run({ type: "sendChase", message: msg })}>Log as sent</button>
                <button className="btn ghost" onClick={() => void navigator.clipboard?.writeText(`${msg.subject}\n\n${msg.body}`)}>Copy text</button>
              </div>
            </div>
          )}

          <div className="card">
            <h2>Timeline</h2>
            <p className="tiny">What the shareholder sees.</p>
            <Timeline events={c.events} />
          </div>
        </div>

        <aside className="stack">
          {/* ---------------- ownership ---------------- */}
          <div className="card ledger">
            <h3>Ownership</h3>
            <div className="row"><span className="k">Assigned to</span><span className="v">{c.assigneeName ?? "Nobody"}</span></div>
            <div className="row"><span className="k">In this state since</span><span className="v">{c.stateSince ? new Date(c.stateSince).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "Not recorded"}</span></div>
            <div className="row"><span className="k">Approved by</span><span className="v">{c.approvedBy ? staff.find((s) => s.id === c.approvedBy)?.name ?? "A former team member" : "Not yet"}</span></div>
            {open && (
              <div className="btn-row" style={{ marginTop: 10 }}>
                {can(role, "claims.assign") ? (
                  <select className="inline-select" aria-label="Assign to" value={c.assigneeId ?? ""} disabled={busy}
                    onChange={(e) => { const m = staff.find((s) => s.id === e.target.value); void run({ type: "assign", assignee: m ? { id: m.id, name: m.name } : null }); }}>
                    <option value="">Nobody</option>
                    {staff.filter((m) => m.role !== "finance").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                ) : canWork && me ? (
                  c.assigneeId === me.id
                    ? <button className="btn ghost sm" disabled={busy} onClick={() => run({ type: "assign", assignee: null })}>Let go of this claim</button>
                    : !c.assigneeId && <button className="btn sm" disabled={busy} onClick={() => run({ type: "assign", assignee: { id: me.id, name: me.name } })}>Take this claim</button>
                ) : null}
              </div>
            )}
            {can(role, "audit.view") && <p className="tiny" style={{ marginTop: 10 }}><Link href={`/ops/audit?claim=${c.id}`}>Who did what on this claim</Link></p>}
          </div>

          {/* ---------------- identity documents ---------------- */}
          <div className="card ledger">
            <h3>Claim pack</h3>
            {!can(role, "filings.view") ? (
              <p className="tiny">Your role doesn&apos;t include identity documents.</p>
            ) : !c.filingId ? (
              <p className="tiny">No filing record attached.</p>
            ) : !showId ? (
              <>
                <p className="tiny">BVN, NIN, bank details, photo and signature. Opening them is recorded in the audit log.</p>
                <button className="btn sm" onClick={loadId}>Show ID documents</button>
              </>
            ) : !filing ? (
              <span className="spin" />
            ) : (
              <>
                <div className="row"><span className="k">Flow</span><span className="v">{filing.flowType === "estate" ? "Estate" : "Own shares"}</span></div>
                <div className="row"><span className="k">Legal name</span><span className="v">{fullName(filing.name)}</span></div>
                <div className="row"><span className="k">Variants</span><span className="v">{filing.variants.join("; ") || "None"}</span></div>
                <div className="row"><span className="k">BVN</span><span className="v">{maskTail(filing.bvn)}</span></div>
                <div className="row"><span className="k">NIN</span><span className="v">{maskTail(filing.nin)}</span></div>
                <div className="row"><span className="k">CHN</span><span className="v">{filing.chn ?? "Not given"}</span></div>
                <div className="row"><span className="k">Address</span><span className="v">{filing.address ?? "Not given"}</span></div>
                {filing.contact && (
                  <>
                    <div className="row"><span className="k">City, state</span><span className="v">{[filing.contact.city, filing.contact.state].filter(Boolean).join(", ") || "Not given"}</span></div>
                    <div className="row"><span className="k">Phone, email</span><span className="v">{[filing.contact.phone, filing.contact.email].filter(Boolean).join(", ") || "Not given"}</span></div>
                  </>
                )}
                <div className="row"><span className="k">Pay to</span><span className="v">{filing.bankName}, {filing.accountNumber}</span></div>
                <div className="row"><span className="k">Filed</span><span className="v">{filing.createdAt}</span></div>
                {filing.administrator && (
                  <>
                    <div className="row"><span className="k">Administrator</span><span className="v">{fullName(filing.administrator.name)} ({filing.administrator.relationship})</span></div>
                    <div className="row"><span className="k">Contact</span><span className="v">{filing.administrator.phone}</span></div>
                    <div className="row"><span className="k">Probate</span><span className="v">{filing.administrator.probateDoc.startsWith("http") ? <a href={filing.administrator.probateDoc} target="_blank" rel="noreferrer">Open document</a> : filing.administrator.probateDoc.split("/").pop()}</span></div>
                  </>
                )}
                <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
                  {(filing.administrator?.photoUrl ?? filing.photoUrl)
                    ? <img className="photo-thumb" src={(filing.administrator?.photoUrl ?? filing.photoUrl)!} alt="Passport photograph" />
                    : <span className="tag red">No photo</span>}
                  {filing.signatureUrl
                    ? <div className="sig-preview"><img src={filing.signatureUrl} alt="Signature on the authority" /></div>
                    : <span className="tag red">No signature on file</span>}
                </div>
                <div style={{ marginTop: 16 }}>
                  <button className="btn sm" disabled={forms.busy} onClick={() => downloadForms(filing.id)}>
                    {forms.busy ? <span className="spin" /> : "Download registrar forms"}
                  </button>
                  <p className="tiny" style={{ marginTop: 6 }}>One filled e-mandate form per registrar on this filing, with the photo, signature and company ticks in place.</p>
                  {forms.error && <div className="field-error">{forms.error}</div>}
                  {forms.report && <FormsReportView report={forms.report} />}
                </div>
              </>
            )}
          </div>

          {reg && (
            <div className="card ledger">
              <h3>{reg.name}</h3>
              <div className="row"><span className="k">Contact</span><span className="v">{reg.contactName || "None recorded"}</span></div>
              <div className="row"><span className="k">Email</span><span className="v">{reg.email || "None"}</span></div>
              <p className="tiny" style={{ marginTop: 8 }}><Link href={`/ops/registrars/${reg.id}`}>Requirements and track record</Link></p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
