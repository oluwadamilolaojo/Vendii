"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WizardShell } from "@/components/WizardShell";
import { PlusIcon, XIcon } from "@/components/icons";
import { useDraft } from "@/lib/draft";
import { VARIANT_KINDS, cleanVariants, fullName, suggestVariant } from "@/lib/domain/names";
import { nextHref, prevHref, stepLabel } from "@/lib/wizard";

export default function VariantsStep() {
  const { draft, update } = useDraft();
  const router = useRouter();
  const [pending, setPending] = useState("");
  const estate = draft.flowType === "estate";

  const add = () => {
    if (!pending.trim()) return;
    update((d) => ({ variants: cleanVariants([...d.variants, pending], d.name) }));
    setPending("");
  };
  const edit = (i: number, v: string) => update((d) => ({ variants: d.variants.map((x, j) => (j === i ? v : x)) }));
  const remove = (i: number) => update((d) => ({ variants: d.variants.filter((_, j) => j !== i) }));
  const next = () => {
    update((d) => ({ variants: cleanVariants(d.variants, d.name) }));
    router.push(nextHref(draft.flowType, "variants"));
  };

  return (
    <WizardShell phase={0} stepLabel={stepLabel(draft.flowType, "variants")} backHref={prevHref(draft.flowType, "variants")}
      footer={
        <div className="btn-row">
          <button className="btn lg" onClick={next}>Continue</button>
          {draft.variants.length === 0 && <span className="tiny">You can continue without any. More spellings usually means more found.</span>}
        </div>
      }>
      <h1>Other ways {estate ? "their" : "your"} name was written</h1>
      <p>
        Share registers are old, hand-typed and full of shortcuts. We search all of these spellings alongside
        <b> {fullName(draft.name) || "the full name"}</b>.
      </p>

      {draft.variants.map((v, i) => (
        <div className="variant-row" key={i}>
          <input className="input" value={v} onChange={(e) => edit(i, e.target.value)} aria-label={`Name variant ${i + 1}`} />
          <button className="icon-btn" onClick={() => remove(i)} aria-label={`Remove ${v}`}><XIcon /></button>
        </div>
      ))}

      <div className="variant-row">
        <input className="input" value={pending} placeholder="Add another spelling"
          onChange={(e) => setPending(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="New name variant" />
        <button className="icon-btn" onClick={add} aria-label="Add this spelling"><PlusIcon /></button>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="tiny" style={{ marginBottom: 8 }}>Common patterns. Tap one to start from it, then edit.</div>
        {VARIANT_KINDS.map(({ kind, label }) => (
          <button key={kind} className="chip" onClick={() => setPending(suggestVariant(draft.name, kind))}><PlusIcon />{label}</button>
        ))}
      </div>
    </WizardShell>
  );
}
