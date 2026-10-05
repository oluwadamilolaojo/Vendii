"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SelectField, TextField } from "@/components/Field";
import { WizardShell } from "@/components/WizardShell";
import { useDraft } from "@/lib/draft";
import { fullName } from "@/lib/domain/names";
import { BANKS } from "@/lib/domain/banks";
import { bankErrors, hasErrors } from "@/lib/domain/validation";
import { prevHref, stepLabel } from "@/lib/wizard";

export default function BankStep() {
  const { draft, update } = useDraft();
  const router = useRouter();
  const [tried, setTried] = useState(false);
  const estate = draft.flowType === "estate";
  const errors = bankErrors(draft);
  const holder = estate ? fullName(draft.administrator.name) || "you, as administrator" : fullName(draft.name) || "you";

  const next = () => {
    setTried(true);
    if (!hasErrors(errors)) router.push("/claim/search");
  };

  return (
    <WizardShell phase={0} stepLabel={stepLabel(draft.flowType, "bank")} backHref={prevHref(draft.flowType, "bank")}
      footer={<button className="btn gold lg" onClick={next}>Search the registers</button>}>
      <h1>Where should the money go?</h1>
      <p>
        The registrar pays this account directly. It must be in the name of <b>{holder}</b>, because registrars reject payments where the names don&apos;t match.
      </p>
      <SelectField label="Bank" value={draft.bankName} onChange={(v) => update({ bankName: v })} options={BANKS}
        placeholder="Choose your bank" error={tried ? errors.bankName : undefined} />
      <TextField label="Account number" value={draft.accountNumber} onChange={(v) => update({ accountNumber: v.replace(/\D/g, "").slice(0, 10) })}
        placeholder="10 digits" inputMode="numeric" error={tried ? errors.accountNumber : undefined} />
      <div className="banner navy">
        <b>We never hold your money</b>
        Vendii has no account in the payment chain. After you&apos;re paid, our 10% is collected by direct debit, and you&apos;re told the exact amount first.
      </div>
    </WizardShell>
  );
}
