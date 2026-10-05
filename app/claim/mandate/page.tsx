"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "@/components/Field";
import { WizardShell } from "@/components/WizardShell";
import { repo } from "@/lib/data";
import { useDraft } from "@/lib/draft";
import { feeFor, naira } from "@/lib/domain/fees";
import { fullName } from "@/lib/domain/names";
import { errorMessage } from "@/lib/util";

export default function MandateStep() {
  const { draft, update } = useDraft();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const estate = draft.flowType === "estate";
  const selected = draft.candidates.filter((c) => draft.selectedIds.includes(c.id) && c.pocket === "registrar");
  const gross = selected.reduce((s, c) => s + c.amount, 0);
  const holder = estate ? fullName(draft.administrator.name) : fullName(draft.name);
  const ready = draft.mandateAcks.every(Boolean) && !!draft.signature;

  async function file() {
    if (!draft.signature) return;
    setBusy(true);
    setError(null);
    try {
      const a = draft.administrator;
      const claims = await repo.fileClaims({
        flowType: draft.flowType, name: draft.name, variants: draft.variants,
        bvn: draft.bvn, nin: draft.nin, chn: draft.chn, address: draft.address, contact: draft.contact, photo: draft.photo,
        administrator: estate && a.probateDocPath && a.probateDocName
          ? { name: a.name, relationship: a.relationship, phone: a.phone, email: a.email, address: a.address, photo: a.photo, probateDocName: a.probateDocName, probateDocPath: a.probateDocPath }
          : null,
        bankName: draft.bankName, accountNumber: draft.accountNumber,
        candidates: draft.candidates, selectedIds: draft.selectedIds,
        signature: draft.signature, poaAcks: draft.poaAcks, mandateAcks: draft.mandateAcks,
      });
      update({ filedIds: claims.map((c) => c.id) });
      router.push("/claim/filed");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <WizardShell phase={2} stepLabel="Authorize, 2 of 2" backHref="/claim/authorize"
      footer={
        <div className="btn-row">
          <button className="btn gold lg" disabled={!ready || busy} onClick={file}>
            {busy ? <span className="spin" /> : "Set up mandate and file my claims"}
          </button>
        </div>
      }>
      <h1>How our fee is collected</h1>
      <p>A NIBSS direct debit mandate on your account. It only ever takes 10% of what a registrar has already paid you.</p>

      <div className="ledger card" style={{ padding: "4px 18px", marginBottom: 16 }}>
        <div className="row"><span className="k">Account</span><span className="v">{draft.bankName}, {draft.accountNumber}</span></div>
        <div className="row"><span className="k">Account holder</span><span className="v">{holder}</span></div>
        <div className="row"><span className="k">Fee rate</span><span className="v">10% of amounts received</span></div>
        <div className="row"><span className="k">If everything is paid as estimated</span><span className="v">{naira(feeFor(gross))} in total</span></div>
        <div className="row"><span className="k">If nothing is paid</span><span className="v">{naira(0)}</span></div>
      </div>

      <Check checked={draft.mandateAcks[0]} onToggle={() => update((d) => ({ mandateAcks: [!d.mandateAcks[0], d.mandateAcks[1]] }))}>
        <b>This is a variable mandate.</b> Each debit is 10% of one specific payment you&apos;ve received, never more.
      </Check>
      <Check checked={draft.mandateAcks[1]} onToggle={() => update((d) => ({ mandateAcks: [d.mandateAcks[0], !d.mandateAcks[1]] }))}>
        <b>You&apos;ll tell me the exact amount before each debit,</b> and I can cancel the mandate through my bank at any time.
      </Check>

      <p className="tiny" style={{ marginTop: 10 }}>Your bank may send its own confirmation to activate the mandate. Claims are filed either way.</p>
      {error && <div className="banner red"><b>We couldn&apos;t file your claims</b>{error}</div>}
    </WizardShell>
  );
}
