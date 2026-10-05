"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormsReportView } from "@/components/FormsReport";
import { StatusTag } from "@/components/StatusTag";
import { Timeline } from "@/components/Timeline";
import { BackIcon } from "@/components/icons";
import { repo } from "@/lib/data";
import { naira } from "@/lib/domain/fees";
import { buildChaseMessage } from "@/lib/domain/messages";
import { fullName } from "@/lib/domain/names";
import type { Claim, Filing, OutboundMessage } from "@/lib/domain/types";
import { saveBlob } from "@/lib/forms/client";
import type { FormsReport } from "@/lib/forms/profile";
import { errorMessage, maskTail } from "@/lib/util";

export default function OpsClaim({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [claim, setClaim] = useState<Claim | null | undefined>(undefined);
  const [filing, setFiling] = useState<Filing | null>(null);
  const [msg, setMsg] = useState<OutboundMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<{ busy: boolean; report: FormsReport | null; error: string | null }>({ busy: false, report: null, error: null });

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

  useEffect(() => {
    (async () => {
      try {
        const c = await repo.getClaim(params.id);
        setClaim(c);
        if (c) {
          setMsg(buildChaseMessage(c));
          if (c.filingId) setFiling(await repo.ops.getFiling(c.filingId));
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
  const canChase = c.status === "submitted" || c.status === "chasing";

  async function run(fn: () => Promise<Claim>, thenBack = false) {
    setBusy(true);
    setError(null);
    try {
      const updated = await fn();
      if (thenBack) router.push("/ops");
      else setClaim(updated);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link className="backlink" href="/ops"><BackIcon />Queue</Link>
      <div className="page-head" style={{ marginTop: 12 }}>
        <div>
          <div className="tags" style={{ marginBottom: 8 }}><StatusTag status={c.status} /></div>
          <h1>{c.company}, {c.ownerName}</h1>
          <p style={{ marginBottom: 0 }}>{c.registrar}{c.ref ? `, ref ${c.ref}` : ""}. {c.units.toLocaleString("en-NG")} units, {c.years}.</p>
        </div>
        <div className="amount" style={{ fontSize: 28 }}>{naira(c.amount)}</div>
      </div>
      {error && <div className="banner red"><b>That action failed</b>{error}</div>}

      <div className="two-col">
        <div className="stack">
          {c.status === "review" && (
            <div className="banner navy">
              <b>Review checklist</b>
              Register name &ldquo;{c.matchedOn}&rdquo; ties to the ID below. Photo is clear. Signature is present. Bank account is in the {filing?.flowType === "estate" ? "administrator's" : "shareholder's"} name. {c.matchNote}
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button className="btn sm" disabled={busy} onClick={() => run(() => repo.ops.approve(c.id))}>Approve and file</button>
              </div>
            </div>
          )}

          {canChase && msg && (
            <div className="card" id="chase">
              <h2>Chase message</h2>
              <p className="tiny">Drafted from the claim. Edit before sending.</p>
              <div className="mail-row"><span className="k">To</span><input className="input" value={msg.to} onChange={(e) => setMsg({ ...msg, to: e.target.value })} aria-label="To" /></div>
              <div className="mail-row"><span className="k">Subject</span><input className="input" value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} aria-label="Subject" /></div>
              <textarea className="input" style={{ marginTop: 12 }} value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} aria-label="Message body" />
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button className="btn" disabled={busy || !msg.to} onClick={() => run(() => repo.ops.sendChase(c.id, msg), true)}>Send and log</button>
                <button className="btn ghost" onClick={() => void navigator.clipboard?.writeText(`${msg.subject}\n\n${msg.body}`)}>Copy text</button>
              </div>
            </div>
          )}

          <div className="card">
            <h2>Timeline</h2>
            <Timeline events={c.events} />
          </div>
        </div>

        <aside className="stack">
          <div className="card ledger">
            <h3>Claim pack</h3>
            {!filing ? (
              <p className="tiny">No filing record attached.</p>
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
        </aside>
      </div>
    </>
  );
}
