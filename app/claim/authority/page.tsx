"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileDrop } from "@/components/FileDrop";
import { SelectField, TextField } from "@/components/Field";
import { WizardShell } from "@/components/WizardShell";
import { DocIcon, PhotoIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth/context";
import { repo } from "@/lib/data";
import { useDraft, type AdministratorDraft } from "@/lib/draft";
import { formatNgPhone, normalizeNgPhone } from "@/lib/domain/phone";
import { isEmail } from "@/lib/domain/validation";
import { resizeImage } from "@/lib/image";
import type { PersonName } from "@/lib/domain/types";
import { nextHref, prevHref, stepLabel } from "@/lib/wizard";

const RELATIONSHIPS = ["Spouse", "Child", "Sibling", "Parent", "Executor named in the will", "Other administrator"];

export default function AuthorityStep() {
  const { draft, update } = useDraft();
  const { session } = useAuth();
  const router = useRouter();
  const [tried, setTried] = useState(false);
  const a = draft.administrator;
  const setA = (patch: Partial<AdministratorDraft>) => update((d) => ({ administrator: { ...d.administrator, ...patch } }));
  const setName = (k: keyof PersonName) => (v: string) => setA({ name: { ...a.name, [k]: v } });

  // Prefill contact details from whatever they signed in with.
  useEffect(() => {
    if (!session) return;
    if (session.channel === "phone" && !a.phone) setA({ phone: formatNgPhone(session.identifier) });
    if (session.channel === "email" && !a.email) setA({ email: session.identifier });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const errors: Record<string, string> = {};
  if (!a.name.first.trim() || !a.name.last.trim()) errors.name = "Enter your first name and surname.";
  if (!a.relationship) errors.relationship = "Tell us how you're related to them.";
  if (!normalizeNgPhone(a.phone)) errors.phone = "Enter a Nigerian mobile number.";
  if (a.email && !isEmail(a.email)) errors.email = "That email doesn't look right.";
  if (!a.probateDocPath) errors.probate = "We can't file an estate claim without Letters of Administration or a Grant of Probate.";
  const show = (k: string) => (tried ? errors[k] : undefined);

  const next = () => {
    setTried(true);
    if (Object.keys(errors).length === 0) router.push(nextHref(draft.flowType, "authority"));
  };

  return (
    <WizardShell phase={0} stepLabel={stepLabel(draft.flowType, "authority")} backHref={prevHref(draft.flowType, "authority")}
      footer={<button className="btn lg" onClick={next}>Continue</button>}>
      <h1>Your authority to claim</h1>
      <p>Registrars pay an estate only to a person the court has appointed. These are your details, not theirs.</p>
      <div className="field-row three">
        <TextField label="Your first name" value={a.name.first} onChange={setName("first")} autoComplete="given-name" error={show("name")} />
        <TextField label="Middle name" value={a.name.middle} onChange={setName("middle")} placeholder="Optional" autoComplete="additional-name" />
        <TextField label="Surname" value={a.name.last} onChange={setName("last")} autoComplete="family-name" />
      </div>
      <SelectField label="Relationship to the deceased" value={a.relationship} onChange={(v) => setA({ relationship: v })}
        options={RELATIONSHIPS} placeholder="Choose one" error={show("relationship")} />
      <div className="field-row">
        <TextField label="Mobile number" value={a.phone} onChange={(v) => setA({ phone: v })} type="tel" inputMode="tel" placeholder="0803 123 4567" error={show("phone")} />
        <TextField label="Email" value={a.email} onChange={(v) => setA({ email: v })} type="email" placeholder="Optional" error={show("email")} />
      </div>
      <TextField label="Your address" value={a.address} onChange={(v) => setA({ address: v })} placeholder="House number, street, area, state" autoComplete="street-address" />
      <FileDrop label="Your passport photograph" accept="image/*" icon={<PhotoIcon />}
        hint="Registrars need a photo of the person receiving payment."
        filledLabel={a.photo ? "Photo added. Tap to replace" : null} preview={a.photo}
        onFile={async (f) => setA({ photo: await resizeImage(f) })} />
      <FileDrop label="Letters of Administration or Grant of Probate" accept="application/pdf,image/*" icon={<DocIcon />}
        hint="A scan or clear photo of the court document naming you. PDF, JPG or PNG, up to 10MB."
        filledLabel={a.probateDocName ? `${a.probateDocName} uploaded` : null}
        onFile={async (f) => {
          const path = await repo.uploadFile("probate", f);
          setA({ probateDocName: f.name, probateDocPath: path });
        }} />
      {show("probate") && <div className="field-error" style={{ marginTop: -8 }}>{show("probate")}</div>}
      <div className="banner plain" style={{ marginTop: 12 }}>
        <b>Don&apos;t have these yet?</b>
        You get them from the Probate Registry of the High Court in the state where they lived. We can tell you what to take along. Your search results are saved, so you can come back.
      </div>
    </WizardShell>
  );
}
