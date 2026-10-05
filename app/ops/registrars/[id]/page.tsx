"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusTag } from "@/components/StatusTag";
import { BackIcon } from "@/components/icons";
import { SlaPill } from "@/components/ops/Sla";
import { repo } from "@/lib/data";
import { isClosed } from "@/lib/domain/claimStatus";
import { naira } from "@/lib/domain/fees";
import { can } from "@/lib/domain/permissions";
import { REQUIREMENT_LABEL, claimRegistrarId, registrarStats } from "@/lib/domain/registrarDesk";
import type { RegistrarProfile, RegistrarRequirements } from "@/lib/domain/types";
import { useOps } from "@/lib/ops/context";
import { errorMessage } from "@/lib/util";

function Tri({ value, onChange, disabled }: { value: boolean | null; onChange: (v: boolean | null) => void; disabled: boolean }) {
  return (
    <div className="tri" role="group">
      <button type="button" disabled={disabled} aria-pressed={value === true} onClick={() => onChange(true)}>Yes</button>
      <button type="button" disabled={disabled} aria-pressed={value === false} onClick={() => onChange(false)}>No</button>
      <button type="button" disabled={disabled} aria-pressed={value === null} onClick={() => onChange(null)}>Unknown</button>
    </div>
  );
}

export default function RegistrarPage({ params }: { params: { id: string } }) {
  const { me, claims, settings } = useOps();
  const [p, setP] = useState<RegistrarProfile | null | undefined>(undefined);
  const [draft, setDraft] = useState<RegistrarProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [now] = useState(() => new Date());
  const editable = can(me?.role, "registrars.edit");

  useEffect(() => {
    repo.ops.registrars().then((all) => { const hit = all.find((r) => r.id === params.id) ?? null; setP(hit); setDraft(hit); })
      .catch((e) => { setMsg({ ok: false, text: errorMessage(e) }); setP(null); });
  }, [params.id]);

  const mine = useMemo(() => (claims ?? []).filter((c) => claimRegistrarId(c) === params.id && c.status !== "draft"), [claims, params.id]);
  const s = useMemo(() => registrarStats(mine, settings.sla, now), [mine, settings, now]);

  if (p === undefined || !claims) return <div className="center-note"><span className="spin" /></div>;
  if (!p || !draft) return <div className="empty"><h2>Registrar not found</h2><Link className="btn" href="/ops/registrars">Back</Link></div>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(p);
  const set = (patch: Partial<RegistrarProfile>) => setDraft({ ...draft, ...patch });
  const setReq = (k: keyof RegistrarRequirements, v: boolean | null) => setDraft({ ...draft, requirements: { ...draft.requirements, [k]: v } });

  async function save() {
    if (!draft) return;
    setBusy(true); setMsg(null);
    try { const saved = await repo.ops.saveRegistrar(draft); setP(saved); setDraft(saved); setMsg({ ok: true, text: "Saved." }); }
    catch (e) { setMsg({ ok: false, text: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  const open = mine.filter((c) => !isClosed(c.status)).sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));

  return (
    <>
      <Link className="backlink" href="/ops/registrars"><BackIcon />Registrars</Link>
      <div className="page-head" style={{ marginTop: 12 }}>
        <div>
          <h1>{p.name}</h1>
          <p style={{ marginBottom: 0 }}>{p.updatedAt ? `Last updated by ${p.updatedBy} on ${new Date(p.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.` : "Nothing confirmed yet beyond what's printed on their form."}</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat-card"><div className="k">{s.open}</div><div className="v">Open ({naira(s.openValue)})</div></div>
        <div className="stat-card"><div className="k" style={{ color: s.overdue ? "var(--red)" : undefined }}>{s.overdue}</div><div className="v">Overdue</div></div>
        <div className="stat-card"><div className="k">{s.medianDaysToPay === null ? "None yet" : `${s.medianDaysToPay} days`}</div><div className="v">Median filing to payment</div></div>
        <div className="stat-card"><div className="k">{s.acceptanceRate === null ? "None closed" : `${Math.round(s.acceptanceRate * 100)}%`}</div><div className="v">Accepted ({s.paid} paid, {s.rejected} rejected)</div></div>
        <div className="stat-card"><div className="k">{s.oldestOpenDays === null ? "None" : `${s.oldestOpenDays} days`}</div><div className="v">Oldest open since filing</div></div>
      </div>

      {msg && <div className={`banner ${msg.ok ? "navy" : "red"}`}><b>{msg.ok ? msg.text : "Couldn't save"}</b>{msg.ok ? "" : msg.text}</div>}

      <div className="two-col">
        <div className="stack">
          <div className="card">
            <h2>What they require</h2>
            <p className="tiny">Set each one when a registrar confirms it in writing or a claim proves it. Unknown is different from no.</p>
            {(Object.keys(REQUIREMENT_LABEL) as (keyof RegistrarRequirements)[]).map((k) => (
              <div className="req-row" key={k}>
                <span>{REQUIREMENT_LABEL[k]}</span>
                <Tri value={draft.requirements[k]} disabled={!editable} onChange={(v) => setReq(k, v)} />
              </div>
            ))}
            <div className="field" style={{ marginTop: 14 }}>
              <label className="label" htmlFor="notes">Notes</label>
              <textarea id="notes" className="input" rows={4} disabled={!editable} value={draft.notes} placeholder="Quirks, who to call, what a rejection usually means" onChange={(e) => set({ notes: e.target.value })} />
            </div>
          </div>

          <div className="card">
            <h2>Open claims</h2>
            {open.length === 0 ? <p className="tiny">None.</p> : (
              <div className="tbl-wrap" style={{ border: 0 }}>
                <table className="tbl">
                  <tbody>
                    {open.map((c) => (
                      <tr key={c.id}>
                        <td><Link href={`/ops/claims/${c.id}`}>{c.company}</Link><div className="sub">{c.ownerName}{c.ref ? ` · ${c.ref}` : ""}</div></td>
                        <td><StatusTag staff status={c.status} /></td>
                        <td><SlaPill c={c} now={now} /></td>
                        <td className="num">{naira(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="stack">
          <div className="card">
            <h3>Contact</h3>
            {(["contactName", "email", "phone", "address"] as const).map((k) => (
              <div className="field" key={k}>
                <label className="label" htmlFor={k}>{k === "contactName" ? "Named contact" : k[0].toUpperCase() + k.slice(1)}</label>
                <input id={k} className="input" disabled={!editable} value={draft[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<RegistrarProfile>)} />
              </div>
            ))}
            <p className="tiny">The named contact is who escalations go to after {settings.sla.escalateAfter} working days of chasing.</p>
          </div>

          <div className="card">
            <h3>Why claims get rejected</h3>
            {s.rejectionReasons.length === 0 ? <p className="tiny">No rejections yet.</p> : s.rejectionReasons.map((r) => (
              <div className="req-row" key={r.reason}><span style={{ fontSize: 13.5 }}>{r.reason}</span><b>{r.count}</b></div>
            ))}
          </div>

          {editable && (
            <button className="btn lg" style={{ width: "100%" }} disabled={!dirty || busy} onClick={save}>{busy ? <span className="spin" /> : dirty ? "Save changes" : "No changes"}</button>
          )}
          {!editable && <p className="tiny">Reviewers and admins can edit this page.</p>}
        </aside>
      </div>
    </>
  );
}
