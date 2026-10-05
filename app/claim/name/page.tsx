"use client";

import { useRouter } from "next/navigation";
import { TextField } from "@/components/Field";
import { WizardShell } from "@/components/WizardShell";
import { useDraft } from "@/lib/draft";
import type { PersonName } from "@/lib/domain/types";
import { nextHref, stepLabel } from "@/lib/wizard";

export default function NameStep() {
  const { draft, update } = useDraft();
  const router = useRouter();
  const estate = draft.flowType === "estate";
  const n = draft.name;
  const set = (k: keyof PersonName) => (v: string) => update((d) => ({ name: { ...d.name, [k]: v } }));
  const valid = n.first.trim() !== "" && n.last.trim() !== "";

  return (
    <WizardShell phase={0} stepLabel={stepLabel(draft.flowType, "name")} backHref="/"
      footer={<button className="btn lg" disabled={!valid} onClick={() => router.push(nextHref(draft.flowType, "name"))}>Continue</button>}>
      {estate ? (
        <>
          <h1>Who were the shares held by?</h1>
          <p>The full name of the person who has died, as it appears on their NIN, passport or death certificate.</p>
          <div className="banner navy">
            <b>Claiming for an estate</b>
            We&apos;ll ask about you, the person claiming, in a later step. First we need their details to find what they were owed.
          </div>
        </>
      ) : (
        <>
          <h1>What&apos;s your full name?</h1>
          <p>Exactly as it appears on your NIN or passport. We use this to prove the shares are yours.</p>
        </>
      )}
      <div className="field-row three">
        <TextField label="First name" value={n.first} onChange={set("first")} placeholder={estate ? "e.g. Folasade" : "e.g. Adewale"} autoComplete={estate ? "off" : "given-name"} />
        <TextField label="Middle name" value={n.middle} onChange={set("middle")} placeholder="Optional" autoComplete={estate ? "off" : "additional-name"} />
        <TextField label="Surname" value={n.last} onChange={set("last")} placeholder="e.g. Ogunyemi" autoComplete={estate ? "off" : "family-name"} />
      </div>
    </WizardShell>
  );
}
