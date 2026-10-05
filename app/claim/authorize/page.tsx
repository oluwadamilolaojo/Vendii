"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "@/components/Field";
import { SignaturePad } from "@/components/SignaturePad";
import { WizardShell } from "@/components/WizardShell";
import { useDraft } from "@/lib/draft";
import { naira } from "@/lib/domain/fees";
import { fullName } from "@/lib/domain/names";

const ACKS = [
  <><b>This authority covers only the claims listed.</b> It doesn&apos;t let Vendii sell, transfer or change anything else on the account.</>,
  <><b>The registrar pays my bank account directly.</b> Vendii never receives or holds the money.</>,
  <><b>I know I can claim from each registrar myself for free,</b> and I&apos;m choosing to have Vendii do it for 10% of what&apos;s recovered.</>,
];

export default function AuthorizeStep() {
  const { draft, update } = useDraft();
  const router = useRouter();
  const estate = draft.flowType === "estate";
  const selected = draft.candidates.filter((c) => draft.selectedIds.includes(c.id) && c.pocket === "registrar");
  const principal = estate
    ? `${fullName(draft.administrator.name)}, as administrator of the estate of ${fullName(draft.name)}`
    : fullName(draft.name);
  const ready = draft.poaAcks.every(Boolean) && !!draft.signature;

  if (selected.length === 0) {
    return (
      <WizardShell phase={2} stepLabel="Authorize" backHref="/claim/results">
        <h1>Choose at least one claim first</h1>
        <Link className="btn" href="/claim/results">Back to results</Link>
      </WizardShell>
    );
  }

  return (
    <WizardShell phase={2} stepLabel="Authorize, 1 of 2" backHref="/claim/results"
      footer={<button className="btn lg" disabled={!ready} onClick={() => router.push("/claim/mandate")}>Sign and continue</button>}>
      <h1>Your limited power of attorney</h1>
      <p>This lets us file and chase the claims below for you, and nothing else. Read it, tick the three points, then sign.</p>

      <div className="legal" tabIndex={0} aria-label="Power of attorney text">
        <h4>1. Parties</h4>
        {principal} (&ldquo;the Principal&rdquo;) appoints Vendii (&ldquo;the Attorney&rdquo;) for the limited purposes below.
        <h4>2. Scope</h4>
        The Attorney may, for the following holdings only:
        <ul>
          {selected.map((c) => <li key={c.id}>{c.company}, held with {c.registrar}, {c.years}, estimated {naira(c.amount)}</li>)}
        </ul>
        complete and submit claim and e-dividend mandate forms, correspond with the registrar, obtain status updates, and supply supporting documents provided by the Principal.
        <h4>3. Limits</h4>
        The Attorney may not sell, transfer, pledge or otherwise deal in any shares, change any bank details other than as set out in this claim, or receive any payment on the Principal&apos;s behalf. All payments go from the registrar to the Principal&apos;s nominated account.
        <h4>4. Fee</h4>
        The Principal pays the Attorney 10% of sums actually received, collected by direct debit after payment, with the exact amount notified before any debit. Nothing is payable if nothing is received.
        <h4>5. Duration and revocation</h4>
        This authority ends when every listed claim is paid or formally closed, or after 12 months, whichever is sooner. The Principal may revoke it at any time in writing.
        {estate && (<><h4>6. Estate</h4>The Principal acts under Letters of Administration or a Grant of Probate, a copy of which accompanies this authority.</>)}
      </div>

      <div style={{ margin: "14px 0 6px" }}>
        {ACKS.map((a, i) => (
          <Check key={i} checked={draft.poaAcks[i]} onToggle={() => update((d) => ({ poaAcks: d.poaAcks.map((v, j) => (j === i ? !v : v)) }))}>{a}</Check>
        ))}
      </div>

      <div className="field">
        <span className="label">Signature of {estate ? fullName(draft.administrator.name) : fullName(draft.name)}</span>
        <SignaturePad value={draft.signature} onChange={(signature) => update({ signature })} />
      </div>
    </WizardShell>
  );
}
