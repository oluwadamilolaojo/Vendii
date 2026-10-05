"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { repo } from "@/lib/data";
import { AUDIT_ACTION_LABEL } from "@/lib/domain/audit";
import { ROLE_LABEL } from "@/lib/domain/permissions";
import type { AuditEntry } from "@/lib/domain/types";
import { errorMessage } from "@/lib/util";

function Log() {
  const params = useSearchParams();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actor, setActor] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const claimId = params.get("claim");

  useEffect(() => { repo.ops.audit().then(setEntries).catch((e) => setError(errorMessage(e))); }, []);

  const actors = useMemo(() => [...new Map((entries ?? []).map((e) => [e.actorId, e.actorName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [entries]);
  const kinds = useMemo(() => [...new Set((entries ?? []).map((e) => e.action))].sort(), [entries]);
  const shown = (entries ?? []).filter((e) =>
    (!claimId || e.claimId === claimId) && (!actor || e.actorId === actor) && (!kind || e.action === kind) &&
    (!q.trim() || e.summary.toLowerCase().includes(q.trim().toLowerCase())));

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["When", "Who", "Role", "Action", "What", "Claim", "Filing", "From", "To"].map(esc).join(","),
      ...shown.map((e) => [e.at, e.actorName, e.actorRole, e.action, e.summary, e.claimId, e.filingId, e.from, e.to].map(esc).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `vendii-audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  if (error) return <div className="banner red"><b>Couldn&apos;t load the audit log</b>{error}</div>;
  if (!entries) return <div className="center-note"><span className="spin" /></div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p style={{ marginBottom: 0 }}>Every change to a claim, every view of someone&apos;s ID documents, every role and settings change. Written in the same step as the change itself, and nobody can edit it.</p>
        </div>
        <button className="btn ghost sm" onClick={exportCsv}>Export {shown.length} rows</button>
      </div>

      {claimId && <div className="banner navy"><b>One claim</b>Showing entries for this claim only. <Link href="/ops/audit">Show everything</Link></div>}

      <div className="filters">
        <select aria-label="Person" value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="">Everyone</option>
          {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select aria-label="Action" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Every action</option>
          {kinds.map((k) => <option key={k} value={k}>{AUDIT_ACTION_LABEL[k] ?? k}</option>)}
        </select>
        <input className="input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </div>

      {shown.length === 0 ? <div className="empty"><h2>No entries</h2><p>Nothing matches these filters.</p></div> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>What happened</th></tr></thead>
            <tbody>
              {shown.slice(0, 500).map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</td>
                  <td>{e.actorName}<div className="sub">{ROLE_LABEL[e.actorRole]}</div></td>
                  <td><span className={`tag ${e.action === "filing.view" ? "gold" : e.action.includes("waive") || e.action.includes("setRole") ? "red" : "navy"}`}>{AUDIT_ACTION_LABEL[e.action] ?? e.action}</span></td>
                  <td>{e.claimId ? <Link href={`/ops/claims/${e.claimId}`} style={{ fontWeight: 400 }}>{e.summary}</Link> : e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {shown.length > 500 && <p className="tiny" style={{ marginTop: 8 }}>Showing the latest 500. Export for the rest, or narrow the filters.</p>}
    </>
  );
}

export default function AuditPage() {
  return <RequireAuth permission="audit.view"><Suspense fallback={<div className="center-note"><span className="spin" /></div>}><Log /></Suspense></RequireAuth>;
}
