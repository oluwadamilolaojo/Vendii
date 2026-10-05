"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileDrop } from "@/components/FileDrop";
import { TextField } from "@/components/Field";
import { WizardShell } from "@/components/WizardShell";
import { PhotoIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth/context";
import { useDraft } from "@/lib/draft";
import { formatNgPhone } from "@/lib/domain/phone";
import { hasErrors, identityErrors } from "@/lib/domain/validation";
import { resizeImage } from "@/lib/image";
import { nextHref, prevHref, stepLabel } from "@/lib/wizard";

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 11);

export default function IdentityStep() {
  const { draft, update } = useDraft();
  const router = useRouter();
  const [tried, setTried] = useState(false);
  const estate = draft.flowType === "estate";
  const { session } = useAuth();
  const contact = draft.contact;
  const setContact = (patch: Partial<typeof contact>) => update((d) => ({ contact: { ...d.contact, ...patch } }));

  // Whatever they signed in with is already verified: start the matching field from it.
  useEffect(() => {
    if (!session || estate) return;
    if (session.channel === "phone" && !contact.phone) setContact({ phone: formatNgPhone(session.identifier) });
    if (session.channel === "email" && !contact.email) setContact({ email: session.identifier });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, estate]);
  const errors = identityErrors(draft);
  const show = (k: string) => (tried ? errors[k] : undefined);

  const next = () => {
    setTried(true);
    if (!hasErrors(errors)) router.push(nextHref(draft.flowType, "identity"));
  };

  return (
    <WizardShell phase={0} stepLabel={stepLabel(draft.flowType, "identity")} backHref={prevHref(draft.flowType, "identity")}
      footer={<button className="btn lg" onClick={next}>Continue</button>}>
      {estate ? (
        <>
          <h1>Their identity details</h1>
          <p>Anything you have helps us match the register. None of these is required, and the Letters of Administration carry most of the weight.</p>
        </>
      ) : (
        <>
          <h1>Prove it&apos;s you</h1>
          <p>Registrars ask for these on every claim form. We check them against the register, and they never leave the claim pack.</p>
        </>
      )}
      <div className="field-row">
        <TextField label="BVN" value={draft.bvn} onChange={(v) => update({ bvn: digits(v) })} placeholder="11 digits" inputMode="numeric" error={show("bvn")} />
        <TextField label="NIN" value={draft.nin} onChange={(v) => update({ nin: digits(v) })} placeholder="11 digits" inputMode="numeric" error={show("nin")} />
      </div>
      <TextField label="CSCS number or CHN" value={draft.chn} onChange={(v) => update({ chn: v.toUpperCase().slice(0, 20) })}
        placeholder="Optional" hint="On old contract notes or CSCS statements. It speeds up matching but you don't need it." />
      <TextField label={estate ? "Last known address" : "Current home address"} value={draft.address} onChange={(v) => update({ address: v })}
        placeholder="House number, street and area" autoComplete={estate ? "off" : "street-address"} error={show("address")} />
      <div className="field-row">
        <TextField label="City or town" value={contact.city} onChange={(v) => setContact({ city: v })} placeholder="Ikeja" autoComplete="address-level2" />
        <TextField label="State" value={contact.state} onChange={(v) => setContact({ state: v })} placeholder="Lagos" autoComplete="address-level1" />
      </div>
      <TextField label="Previous address" value={contact.previousAddress} onChange={(v) => setContact({ previousAddress: v })}
        placeholder="Optional" hint="Only if the shares were bought while you lived somewhere else. Registrars match on it." />
      {!estate && (
        <div className="field-row">
          <TextField label="Mobile number" value={contact.phone} onChange={(v) => setContact({ phone: v })} placeholder="0803 123 4567" type="tel" inputMode="tel" autoComplete="tel" />
          <TextField label="Email" value={contact.email} onChange={(v) => setContact({ email: v })} placeholder="you@example.com" type="email" inputMode="email" autoComplete="email" />
        </div>
      )}
      {!estate && (
        <FileDrop label="Passport photograph" accept="image/*" icon={<PhotoIcon />}
          hint="A clear, recent photo on a plain background. Most registrar forms need one."
          filledLabel={draft.photo ? "Photo added. Tap to replace" : null} preview={draft.photo}
          onFile={async (f) => update({ photo: await resizeImage(f) })} />
      )}
    </WizardShell>
  );
}
