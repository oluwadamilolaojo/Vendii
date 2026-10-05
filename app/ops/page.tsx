"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusTag } from "@/components/StatusTag";
import { SlaPill } from "@/components/ops/Sla";
import { STAFF_STATUS_LABEL, isClosed } from "@/lib/domain/claimStatus";
import { naira } from "@/lib/domain/fees";
import { can } from "@/lib/domain/permissions";
import { claimRegistrarId } from "@/lib/domain/registrarDesk";
import { ageInDays, needsEscalation, slaState } from "@/lib/domain/sla";
import type { Claim, ClaimStatus } from "@/lib/domain/types";
import { useOps } from "@/lib/ops/context";
import { errorMessage } from "@/lib/util";

type View = "mine" | "unassigned" | "overdue" | "open" | "closed";

const VIEW_LABEL: Record<View, string> = { mine: "Mine", unassigned: "Unassigned", overdue: "Overdue", open: "All open", closed: "Closed" };
const STATUSES: ClaimStatus[] = ["review", "submitted", "chasing", "exception", "hold", "collected", "paid", "rejected"];

/** Overdue first, then soonest deadline, then shareholder check-in requests, then oldest. */
function byUrgency(a: Claim, b: Claim) {
  const ad = a.dueAt ?? "9999", bd = b.dueAt ?? "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  if (a.chaseRequested !== b.chaseRequested) return a.chaseRequested ? -1 : 1;
  return (a.stateSince ?? "").localeCompare(b.stateSince ?? "");
}

export default function Queue() {
  const { me, claims, staff, settings, error, bulk } = useOps();
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<ClaimStatus | "">("");
  const [registrar, setRegistrar] = useState("");
  const [assignee, setAssignee] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: string; failed: { id: string; error: string }[] } | null>(null);
  const [now] = useState(() => new Date());

  const all = useMemo(() => (claims ?? []).filter((c) => c.status !== "draft"), [claims]);
  const mine = useMemo(() => all.filter((c) => c.assigneeId === me?.id && !isClosed(c.status)), [all, me]);

  // Open on "Mine" if there's anything in it, otherwise everything open.
  useEffect(() => { if (claims && view === null) setView(mine.length ? "mine" : "open"); }, [claims, mine.length, view]);

  const registrars = useMemo(() => [...new Map(all.map((c) => [claimRegistrarId(c), c.registrar])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [all]);

  const shown = useMemo(() => {
    const v = view ?? "open";
    const needle = q.trim().toLowerCase();
    return all.filter((c) => {
      const closed = isClosed(c.status);
      if (v === "closed" ? !closed : closed) return false;
      if (v === "mine" && c.assigneeId !== me?.id) return false;
      if (v === "unassigned" && c.assigneeId) return false;
      if (v === "overdue" && slaState(c, now) !== "overdue") return false;
      if (status && c.status !== status) return false;
      if (registrar && claimRegistrarId(c) !== registrar) return false;
      if (assignee && (assignee === "-" ? c.assigneeId : c.assigneeId !== assignee)) return false;
      if (needle && !`${c.company} ${c.ownerName} ${c.registrar} ${c.ref ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    }).sort(byUrgency);
  }, [all, view, status, registrar, assignee, q, me, now]);

  const open = all.filter((c) => !isClosed(c.status));
  const counts = {
    mine: mine.length,
    overdue: open.filter((c) => slaState(c, now) === "overdue").length,
    today: open.filter((c) => slaState(c, now) === "today").length,
    unassigned: open.filter((c) => !c.assigneeId).length,
    review: open.filter((c) => c.status === "review").length,
    escalate: open.filter((c) => needsEscalation(c, settings.sla, now)).length,
  };

  const selected = shown.filter((c) => sel.has(c.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = shown.length > 0 && shown.every((c) => sel.has(c.id));

  async function run(label: string, action: Parameters<typeof bulk>[1]) {
    setBusy(true); setNote(null);
    try {
      const r = await bulk(selected.map((c) => c.id), action);
      setNote({ ok: `${r.done} ${label}.`, failed: r.failed });
      setSel(new Set(r.failed.map((f) => f.id)));
    } catch (e) {
      setNote({ ok: "", failed: [{ id: "", error: errorMessage(e) }] });
    } finally { setBusy(false); }
  }

  if (!claims) return <div className="center-note"><span className="spin" /></div>;
  const role = me?.role;
  const nameOf = (id: string) => all.find((c) => c.id === id)?.company ?? id;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Queue</h1>
          <p style={{ marginBottom: 0 }}>Every claim ends paid, rejected with a written reason, or on a named exception. Overdue work comes first.</p>
        </div>
      </div>

      {error && <div className="banner red"><b>Couldn&apos;t load the queue</b>{error}</div>}

      <div className="stats">
        <button className="stat-card" style={{ textAlign: "left" }} onClick={() => setView("mine")}><div className="k">{counts.mine}</div><div className="v">Assigned to me</div></button>
        <button className="stat-card" style={{ textAlign: "left" }} onClick={() => setView("overdue")}><div className="k" style={{ color: counts.overdue ? "var(--red)" : undefined }}>{counts.overdue}</div><div className="v">Overdue</div></button>
        <div className="stat-card"><div className="k">{counts.today}</div><div className="v">Due today</div></div>
        <button className="stat-card" style={{ textAlign: "left" }} onClick={() => setView("unassigned")}><div className="k">{counts.unassigned}</div><div className="v">Unassigned</div></button>
        <div className="stat-card"><div className="k">{counts.review}</div><div className="v">Awaiting review</div></div>
        <div className="stat-card"><div className="k" style={{ color: counts.escalate ? "var(--gold-deep)" : undefined }}>{counts.escalate}</div><div className="v">Ready to escalate</div></div>
      </div>

      <div className="filters">
        {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
          <button key={v} className="chip" aria-pressed={view === v} onClick={() => { setView(v); setSel(new Set()); }}>
            {VIEW_LABEL[v]}{v === "mine" ? ` ${counts.mine}` : v === "overdue" ? ` ${counts.overdue}` : v === "unassigned" ? ` ${counts.unassigned}` : ""}
          </button>
        ))}
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as ClaimStatus | "")}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STAFF_STATUS_LABEL[s]}</option>)}
        </select>
        <select aria-label="Registrar" value={registrar} onChange={(e) => setRegistrar(e.target.value)}>
          <option value="">Any registrar</option>
          {registrars.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Anyone</option>
          <option value="-">Nobody</option>
          {staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input className="input" placeholder="Search company, name, ref" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </div>

      {selected.length > 0 && (
        <div className="bulkbar" role="region" aria-label="Bulk actions">
          <b>{selected.length} selected</b>
          {can(role, "claims.work") && <button className="btn quiet sm" disabled={busy} onClick={() => me && run("assigned to you", { type: "assign", assignee: { id: me.id, name: me.name } })}>Take them</button>}
          {can(role, "claims.assign") && (
            <>
              <select aria-label="Assign to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                <option value="">Assign to…</option>
                {staff.filter((m) => m.role !== "finance").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                <option value="-">Nobody</option>
              </select>
              <button className="btn quiet sm" disabled={busy || !assignTo} onClick={() => {
                const m = staff.find((s) => s.id === assignTo);
                void run(m ? `assigned to ${m.name}` : "unassigned", { type: "assign", assignee: m ? { id: m.id, name: m.name } : null });
              }}>Assign</button>
            </>
          )}
          {can(role, "claims.approve") && selected.some((c) => c.status === "review" && c.confidence === "high") && (
            <button className="btn gold sm" disabled={busy} onClick={() => run("approved and filed", { type: "approve" })}>
              Approve {selected.filter((c) => c.status === "review" && c.confidence === "high").length} confirmed match{selected.filter((c) => c.status === "review" && c.confidence === "high").length === 1 ? "" : "es"}
            </button>
          )}
          {can(role, "claims.approve") && selected.some((c) => c.status === "review" && c.confidence !== "high") && (
            <span className="tiny" style={{ color: "#fff" }}>Weaker matches are approved one at a time.</span>
          )}
          <button className="btn quiet sm" onClick={() => setSel(new Set())}>Clear</button>
          {busy && <span className="spin" />}
        </div>
      )}

      {note && (
        <div className={`banner ${note.failed.length ? "gold" : "navy"}`}>
          {note.ok && <b>{note.ok}</b>}
          {note.failed.map((f, i) => <div key={i}>{f.id ? `${nameOf(f.id)}: ` : ""}{f.error}</div>)}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="empty"><h2>{view === "mine" ? "Nothing assigned to you" : view === "overdue" ? "Nothing overdue" : "No claims here"}</h2><p>{view === "mine" ? "Take some from Unassigned, or ask a reviewer." : "Try another view or clear the filters."}</p></div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 34 }}><input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(shown.map((c) => c.id)))} /></th>
                <th>Claim</th><th>Status</th><th>Owner</th><th>Deadline</th><th className="num">In this state</th><th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const age = ageInDays(c.stateSince, now);
                return (
                  <tr key={c.id} className={sel.has(c.id) ? "sel" : undefined}>
                    <td><input type="checkbox" aria-label={`Select ${c.company}`} checked={sel.has(c.id)} onChange={() => toggle(c.id)} /></td>
                    <td>
                      <Link href={`/ops/claims/${c.id}`}>{c.company}</Link>
                      <div className="sub">{c.ownerName} · {c.registrar}{c.ref ? ` · ${c.ref}` : ""}</div>
                      <div className="tags" style={{ marginTop: 4 }}>
                        {c.chaseRequested && <span className="tag red">Shareholder asked for a check-in</span>}
                        {needsEscalation(c, settings.sla, now) && <span className="tag gold">Escalate</span>}
                        {c.confidence !== "high" && c.status === "review" && <span className="tag gold">{c.confidence} confidence</span>}
                        {c.fee?.status === "failed" && <span className="tag red">Debit failed</span>}
                      </div>
                    </td>
                    <td><StatusTag staff status={c.status} /></td>
                    <td>{c.assigneeName ?? <span className="tiny">Unassigned</span>}</td>
                    <td><SlaPill c={c} now={now} /></td>
                    <td className="num">{age === null ? "" : age === 0 ? "Today" : `${age}d`}</td>
                    <td className="num">{naira(c.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
