"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { DATA_SOURCE } from "@/lib/config";
import { repo } from "@/lib/data";
import { ROLE_BLURB, ROLE_LABEL, STAFF_ROLES } from "@/lib/domain/permissions";
import { isClosed } from "@/lib/domain/claimStatus";
import { slaState } from "@/lib/domain/sla";
import type { StaffRole } from "@/lib/domain/types";
import { useOps } from "@/lib/ops/context";
import { errorMessage } from "@/lib/util";

function Team() {
  const { me, staff, claims, reload } = useOps();
  const [form, setForm] = useState({ identifier: "", name: "", role: "agent" as StaffRole });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function setRole(identifier: string, name: string, role: StaffRole | null, key: string) {
    setBusy(key); setMsg(null);
    try {
      await repo.ops.setRole({ identifier, name, role });
      await reload();
      setMsg({ ok: true, text: role ? `${name || identifier} is now ${ROLE_LABEL[role].toLowerCase()}.` : `${name || identifier} no longer has staff access.` });
      if (key === "new") setForm({ identifier: "", name: "", role: "agent" });
    } catch (e) { setMsg({ ok: false, text: errorMessage(e) }); }
    finally { setBusy(null); }
  }

  const load = (id: string) => {
    const open = (claims ?? []).filter((c) => c.assigneeId === id && !isClosed(c.status));
    return { open: open.length, overdue: open.filter((c) => slaState(c) === "overdue").length };
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p style={{ marginBottom: 0 }}>Who can do what. Role changes take effect at once and are written to the audit log. You can&apos;t change your own.</p>
        </div>
      </div>

      {msg && <div className={`banner ${msg.ok ? "navy" : "red"}`}><b>{msg.ok ? "Done" : "Couldn't change that"}</b>{msg.text}</div>}

      <div className="two-col">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Person</th><th>Role</th><th className="num">Open claims</th><th className="num">Overdue</th><th /></tr></thead>
            <tbody>
              {staff.map((m) => {
                const l = load(m.id);
                const self = m.id === me?.id;
                return (
                  <tr key={m.id}>
                    <td><b>{m.name}</b>{self && <span className="tag navy" style={{ marginLeft: 6 }}>You</span>}<div className="sub">{m.identifier}</div></td>
                    <td>
                      {self ? ROLE_LABEL[m.role] : (
                        <select className="inline-select" value={m.role} disabled={busy === m.id} aria-label={`Role for ${m.name}`}
                          onChange={(e) => setRole(m.identifier, m.name, e.target.value as StaffRole, m.id)}>
                          {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="num">{l.open || ""}</td>
                    <td className="num" style={{ color: l.overdue ? "var(--red)" : undefined }}>{l.overdue || ""}</td>
                    <td>{!self && <button className="btn ghost sm" disabled={busy === m.id} onClick={() => setRole(m.identifier, m.name, null, m.id)}>Remove</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside className="stack">
          <div className="card">
            <h3>Add someone</h3>
            <p className="tiny">{DATA_SOURCE === "firebase" ? "They need to have signed in to Vendii once. Use the email or +234 number they signed in with." : "Demo mode: they can then sign in with this email or number and code 123456."}</p>
            <div className="field"><label className="label" htmlFor="tn">Name</label><input id="tn" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label className="label" htmlFor="ti">Email or phone</label><input id="ti" className="input" value={form.identifier} placeholder="name@vendii.ng or +2348031234567" onChange={(e) => setForm({ ...form, identifier: e.target.value })} /></div>
            <div className="field">
              <label className="label" htmlFor="tr">Role</label>
              <select id="tr" className="inline-select" style={{ width: "100%" }} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
                {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <p className="tiny" style={{ marginTop: 6 }}>{ROLE_BLURB[form.role]}</p>
            </div>
            <button className="btn" disabled={!form.identifier.trim() || busy === "new"} onClick={() => setRole(form.identifier, form.name, form.role, "new")}>{busy === "new" ? <span className="spin" /> : "Give access"}</button>
          </div>
          <div className="card">
            <h3>Roles</h3>
            {STAFF_ROLES.map((r) => <p key={r} className="tiny"><b>{ROLE_LABEL[r]}.</b> {ROLE_BLURB[r]}</p>)}
            <p className="tiny"><b>Always.</b> Whoever approves a claim can&apos;t debit or waive its fee, whatever their role.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function TeamPage() {
  return <RequireAuth permission="team.manage"><Team /></RequireAuth>;
}
