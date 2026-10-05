"use client";

import { useMemo, useState } from "react";
import { TextField } from "@/components/Field";
import { FileDrop } from "@/components/FileDrop";
import { FormsReportView } from "@/components/FormsReport";
import { SignaturePad } from "@/components/SignaturePad";
import { PhotoIcon } from "@/components/icons";
import { buildForms, saveBlob } from "@/lib/forms/client";
import type { FormsReport } from "@/lib/forms/profile";
import { emptyProfile, searchCompanies, type DirectoryEntry } from "@/lib/forms/registry";
import type { FormProfile } from "@/lib/forms/types";
import { resizeImage } from "@/lib/image";
import { errorMessage } from "@/lib/util";

type Picked = Pick<DirectoryEntry, "company" | "registrarId" | "registrar">;
const key = (p: Picked) => `${p.registrarId}::${p.company}`;

export default function FormsPage() {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [profile, setProfile] = useState<FormProfile>(emptyProfile());
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FormsReport | null>(null);

  const results = useMemo(() => searchCompanies(query, 8), [query]);
  const byRegistrar = useMemo(() => {
    const m = new Map<string, Picked[]>();
    for (const p of picked) m.set(p.registrar, [...(m.get(p.registrar) ?? []), p]);
    return [...m.entries()];
  }, [picked]);

  const set = (k: keyof FormProfile) => (v: string) => setProfile((p) => ({ ...p, [k]: v }));
  const digits = (k: keyof FormProfile, n: number) => (v: string) => set(k)(v.replace(/\D/g, "").slice(0, n));
  const add = (e: Picked) => { if (!picked.some((p) => key(p) === key(e))) setPicked([...picked, e]); setQuery(""); };
  const remove = (e: Picked) => setPicked(picked.filter((p) => key(p) !== key(e)));

  const missing = [
    !picked.length && "a company",
    !profile.surname.trim() && "your surname",
    !profile.firstName.trim() && "your first name",
    !/^\d{11}$/.test(profile.bvn) && "your 11-digit BVN",
    !profile.bankName.trim() && "your bank",
    !/^\d{10}$/.test(profile.accountNumber) && "your 10-digit account number",
    !signature && "your signature",
  ].filter(Boolean) as string[];

  async function download() {
    setBusy(true); setError(null); setReport(null);
    try {
      const r = await buildForms({ profile, holdings: picked.map((p) => ({ registrarId: p.registrarId, company: p.company })), photo, signature });
      saveBlob(r.blob, r.filename);
      setReport(r.report);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fill your registrar forms</h1>
          <p>Tell us which companies you hold shares in and give your details once. We fill every registrar&apos;s e-dividend mandate form for you, with your photo and signature in place and the right companies ticked.</p>
        </div>
      </div>

      <div className="two-col">
        <div className="stack">
          <section className="card">
            <h2>Where you hold shares</h2>
            <TextField label="Company name" value={query} onChange={setQuery} placeholder="Start typing, e.g. Coronation Insurance"
              hint="We know which registrar keeps each company's register, from their own forms." />
            {query.trim().length >= 2 && (
              results.length ? (
                <div className="stack" style={{ gap: 6 }}>
                  {results.map((r) => (
                    <button key={key(r)} type="button" className="card" style={{ textAlign: "left", padding: "10px 14px", cursor: "pointer" }} onClick={() => add(r)}>
                      <b>{r.company}</b>
                      <div className="tiny">{r.registrar}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="tiny">No registrar form we hold lists &ldquo;{query}&rdquo;. Try a shorter name, or leave this one for us to file by hand.</p>
              )
            )}
            {byRegistrar.length > 0 && (
              <div className="stack" style={{ marginTop: 16 }}>
                {byRegistrar.map(([registrar, items]) => (
                  <div key={registrar}>
                    <div className="tiny" style={{ fontWeight: 600 }}>{registrar}</div>
                    <div className="tags" style={{ marginTop: 6 }}>
                      {items.map((p) => (
                        <button key={key(p)} type="button" className="tag navy" onClick={() => remove(p)} aria-label={`Remove ${p.company}`}>
                          {p.company} &times;
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2>Your details</h2>
            <p className="tiny">Exactly as your bank and the registrar hold them. Block capitals are added for you.</p>
            <div className="field-row three">
              <TextField label="Surname" value={profile.surname} onChange={set("surname")} autoComplete="family-name" />
              <TextField label="First name" value={profile.firstName} onChange={set("firstName")} autoComplete="given-name" />
              <TextField label="Other names" value={profile.otherNames} onChange={set("otherNames")} placeholder="Optional" autoComplete="additional-name" />
            </div>
            <div className="field-row three">
              <TextField label="BVN" value={profile.bvn} onChange={digits("bvn", 11)} inputMode="numeric" placeholder="11 digits" />
              <TextField label="Bank" value={profile.bankName} onChange={set("bankName")} placeholder="Guaranty Trust Bank" />
              <TextField label="Account number" value={profile.accountNumber} onChange={digits("accountNumber", 10)} inputMode="numeric" placeholder="10 digits" />
            </div>
            <TextField label="Home address" value={profile.address} onChange={set("address")} placeholder="House number, street and area" autoComplete="street-address" />
            <div className="field-row three">
              <TextField label="City or town" value={profile.city} onChange={set("city")} autoComplete="address-level2" />
              <TextField label="State" value={profile.state} onChange={set("state")} autoComplete="address-level1" />
              <TextField label="Country" value={profile.country} onChange={set("country")} autoComplete="country-name" />
            </div>
            <TextField label="Previous address" value={profile.previousAddress} onChange={set("previousAddress")} placeholder="Optional" />
            <div className="field-row three">
              <TextField label="CHN" value={profile.chn} onChange={(v) => set("chn")(v.toUpperCase().slice(0, 20))} placeholder="Optional" />
              <TextField label="Mobile number" value={profile.phone1} onChange={set("phone1")} type="tel" inputMode="tel" autoComplete="tel" />
              <TextField label="Second number" value={profile.phone2} onChange={set("phone2")} type="tel" inputMode="tel" placeholder="Optional" />
            </div>
            <TextField label="Email" value={profile.email} onChange={set("email")} type="email" inputMode="email" autoComplete="email" />
          </section>

          <section className="card">
            <h2>Photo and signature</h2>
            <FileDrop label="Passport photograph" accept="image/*" icon={<PhotoIcon />}
              hint="A clear, recent photo on a plain background. It goes in the passport box on each form."
              filledLabel={photo ? "Photo added. Tap to replace" : null} preview={photo}
              onFile={async (f) => setPhoto(await resizeImage(f))} />
            <div className="field" style={{ marginTop: 12 }}>
              <span className="label">Signature</span>
              <SignaturePad value={signature} onChange={setSignature} />
              <p className="tiny">Sign the way you signed when you bought the shares. Registrars compare it with their specimen.</p>
            </div>
          </section>
        </div>

        <aside className="card ledger" style={{ position: "sticky", top: 24 }}>
          <h3>Your forms</h3>
          {byRegistrar.length === 0 ? (
            <p className="tiny">Add a company and its registrar&apos;s form appears here.</p>
          ) : (
            byRegistrar.map(([registrar, items]) => (
              <div className="row" key={registrar}><span className="k">{registrar}</span><span className="v">{items.length} {items.length === 1 ? "company" : "companies"}</span></div>
            ))
          )}
          <button className="btn gold lg" style={{ width: "100%", marginTop: 16 }} disabled={busy || missing.length > 0} onClick={download}>
            {busy ? <span className="spin" /> : byRegistrar.length > 1 ? `Download ${byRegistrar.length} filled forms` : "Download my filled form"}
          </button>
          {missing.length > 0 && <p className="tiny" style={{ marginTop: 8 }}>Still needed: {missing.join(", ")}.</p>}
          {error && <div className="field-error">{error}</div>}
          {report && <FormsReportView report={report} />}
          <p className="tiny" style={{ marginTop: 12 }}>Print each page, have your bank stamp it where the form asks, and return it to the registrar at the address on the form.</p>
        </aside>
      </div>
    </>
  );
}
