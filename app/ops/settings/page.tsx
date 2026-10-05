"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { repo } from "@/lib/data";
import { FEE_RATE } from "@/lib/domain/fees";
import { DEFAULT_SLA } from "@/lib/domain/sla";
import { SLA_LABEL } from "@/lib/domain/settings";
import type { SlaPolicy } from "@/lib/domain/types";
import { useOps } from "@/lib/ops/context";
import { errorMessage } from "@/lib/util";

function SettingsForm() {
  const { settings, setSettings } = useOps();
  const [sla, setSla] = useState<Record<keyof SlaPolicy, string>>(() => Object.fromEntries(Object.entries(settings.sla).map(([k, v]) => [k, String(v)])) as Record<keyof SlaPolicy, string>);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { setSla(Object.fromEntries(Object.entries(settings.sla).map(([k, v]) => [k, String(v)])) as Record<keyof SlaPolicy, string>); }, [settings]);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const next = await repo.ops.saveSettings({ sla: Object.fromEntries(Object.entries(sla).map(([k, v]) => [k, Number(v)])) as unknown as SlaPolicy });
      setSettings(next);
      setMsg({ ok: true, text: "Saved. New deadlines apply from each claim's next status change." });
    } catch (e) { setMsg({ ok: false, text: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head"><div><h1>Settings</h1></div></div>
      {msg && <div className={`banner ${msg.ok ? "navy" : "red"}`}><b>{msg.ok ? "Saved" : "Couldn't save"}</b>{msg.text}</div>}
      <div className="two-col">
        <div className="card">
          <h2>Service deadlines</h2>
          <p className="tiny">Working days allowed in each state before a claim shows as overdue. Weekends don&apos;t count. Public holidays aren&apos;t modelled yet, so expect a few false overdues around them.</p>
          {(Object.keys(DEFAULT_SLA) as (keyof SlaPolicy)[]).map((k) => (
            <div className="req-row" key={k}>
              <span>{SLA_LABEL[k]}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input className="input" style={{ width: 80, minHeight: 0, height: 36 }} inputMode="numeric" value={sla[k]} aria-label={SLA_LABEL[k]}
                  onChange={(e) => setSla({ ...sla, [k]: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
                <span className="tiny">days{DEFAULT_SLA[k] !== Number(sla[k]) ? ` (default ${DEFAULT_SLA[k]})` : ""}</span>
              </span>
            </div>
          ))}
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy} onClick={save}>{busy ? <span className="spin" /> : "Save deadlines"}</button>
            <button className="btn ghost" onClick={() => setSla(Object.fromEntries(Object.entries(DEFAULT_SLA).map(([k, v]) => [k, String(v)])) as Record<keyof SlaPolicy, string>)}>Reset to defaults</button>
          </div>
        </div>
        <aside className="card">
          <h3>Why the fee isn&apos;t here</h3>
          <p className="tiny">The {Math.round(FEE_RATE * 100)}% fee is written into the power of attorney and the NIBSS mandate each shareholder signs. A setting that changed it would make the app disagree with a legal document. A new rate means new authority wording and fresh signatures. To charge less on a claim, waive the fee from the money room; that&apos;s logged with a reason.</p>
        </aside>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return <RequireAuth permission="settings.edit"><SettingsForm /></RequireAuth>;
}
