"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { repo } from "@/lib/data";
import { naira } from "@/lib/domain/fees";
import { claimRegistrarId, confirmedRequirements, registrarStats } from "@/lib/domain/registrarDesk";
import type { RegistrarProfile } from "@/lib/domain/types";
import { useOps } from "@/lib/ops/context";
import { errorMessage } from "@/lib/util";

const pct = (x: number | null) => (x === null ? "None closed" : `${Math.round(x * 100)}%`);

export default function RegistrarDesk() {
  const { claims, settings } = useOps();
  const [profiles, setProfiles] = useState<RegistrarProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => { repo.ops.registrars().then(setProfiles).catch((e) => setError(errorMessage(e))); }, []);

  const rows = useMemo(() => (profiles ?? []).map((p) => {
    const mine = (claims ?? []).filter((c) => claimRegistrarId(c) === p.id);
    return { p, s: registrarStats(mine, settings.sla, now), total: mine.filter((c) => c.status !== "draft").length };
  }).sort((a, b) => b.s.overdue - a.s.overdue || b.s.open - a.s.open || a.p.name.localeCompare(b.p.name)), [profiles, claims, settings, now]);

  if (error) return <div className="banner red"><b>Couldn&apos;t load registrars</b>{error}</div>;
  if (!profiles || !claims) return <div className="center-note"><span className="spin" /></div>;

  const active = rows.filter((r) => r.total > 0);
  const totals = active.reduce((t, r) => ({ open: t.open + r.s.open, overdue: t.overdue + r.s.overdue, escalate: t.escalate + r.s.escalate, value: t.value + r.s.openValue }), { open: 0, overdue: 0, escalate: 0, value: 0 });
  const known = rows.reduce((n, r) => n + confirmedRequirements(r.p.requirements), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Registrars</h1>
          <p style={{ marginBottom: 0 }}>How each registrar actually behaves: what they demand, how fast they pay, and why they say no. The matrix fills in claim by claim.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat-card"><div className="k">{totals.open}</div><div className="v">Open claims</div></div>
        <div className="stat-card"><div className="k">{naira(totals.value)}</div><div className="v">Value in progress</div></div>
        <div className="stat-card"><div className="k" style={{ color: totals.overdue ? "var(--red)" : undefined }}>{totals.overdue}</div><div className="v">Overdue</div></div>
        <div className="stat-card"><div className="k">{totals.escalate}</div><div className="v">Ready to escalate</div></div>
        <div className="stat-card"><div className="k">{known} of {rows.length * 6}</div><div className="v">Requirements confirmed</div></div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Registrar</th><th className="num">Open</th><th className="num">Overdue</th><th className="num">Oldest open</th><th className="num">Median days to pay</th><th>Acceptance</th><th className="num">Matrix</th></tr>
          </thead>
          <tbody>
            {rows.map(({ p, s, total }) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/ops/registrars/${p.id}`}>{p.name}</Link>
                  <div className="sub">{p.contactName ? `${p.contactName} · ` : ""}{p.email || "No email"}</div>
                </td>
                <td className="num">{s.open || <span className="tiny">0</span>}</td>
                <td className="num" style={{ color: s.overdue ? "var(--red)" : undefined, fontWeight: s.overdue ? 600 : undefined }}>{s.overdue || ""}</td>
                <td className="num">{s.oldestOpenDays === null ? "" : `${s.oldestOpenDays}d`}</td>
                <td className="num">{s.medianDaysToPay === null ? "" : `${s.medianDaysToPay}d`}</td>
                <td>
                  {total === 0 ? <span className="tiny">No claims yet</span> : (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div className="mini-bar" style={{ width: 70 }}><span style={{ width: `${Math.round((s.acceptanceRate ?? 0) * 100)}%` }} /></div>
                      <span className="tiny">{pct(s.acceptanceRate)}{s.paid + s.rejected ? ` of ${s.paid + s.rejected}` : ""}</span>
                    </div>
                  )}
                </td>
                <td className="num"><span className="tiny">{confirmedRequirements(p.requirements)}/6</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny" style={{ marginTop: 10 }}>Days to pay runs from filing to the registrar paying the shareholder. Acceptance is paid out of everything closed.</p>
    </>
  );
}
