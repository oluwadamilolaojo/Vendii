"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { TextField } from "@/components/Field";
import { auth, type OtpChannel } from "@/lib/auth";
import { useAuth } from "@/lib/auth/context";
import { DATA_SOURCE, MOCK_OTP } from "@/lib/config";
import { formatNgPhone, normalizeNgPhone } from "@/lib/domain/phone";
import { isEmail } from "@/lib/domain/validation";
import { errorMessage, safeNext } from "@/lib/util";

type Method = "phone" | "email";

export function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const next = safeNext(params.get("next"));
  const fromClaim = next.startsWith("/claim/");

  const [method, setMethod] = useState<Method>("phone");
  const caps = auth.capabilities;
  const [phoneChannel, setPhoneChannel] = useState<"sms" | "whatsapp">(caps.whatsapp ? "whatsapp" : "sms");
  const [identifier, setIdentifier] = useState("");
  const [stage, setStage] = useState<"enter" | "verify">("enter");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  const normalized = method === "phone" ? normalizeNgPhone(identifier) : isEmail(identifier) ? identifier.trim().toLowerCase() : null;
  const channel: OtpChannel = method === "email" ? "email" : phoneChannel;

  async function send() {
    if (!normalized) {
      setError(method === "phone" ? "Enter a Nigerian mobile number, like 0803 123 4567." : "Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.sendCode(channel, normalized);
      setStage("verify");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!normalized) return;
    setBusy(true);
    setError(null);
    try {
      await auth.verifyCode(channel, normalized, code);
      router.replace(next);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const sentTo = normalized ? (method === "phone" ? formatNgPhone(normalized) : normalized) : "";
  const via = method === "email" ? "email" : phoneChannel === "whatsapp" ? "WhatsApp" : "SMS";
  const linkOnly = method === "email" && !caps.emailCode;

  return (
    <div className="wizshell">
      <aside className="wiz-left">
        <Link href="/" className="wiz-mark" aria-label="Dividendi home"><Logo height={30} onDark /></Link>
        <h2 style={{ color: "#fff", fontSize: 24, maxWidth: "18ch" }}>
          {fromClaim ? "One quick check before we search." : "Welcome back."}
        </h2>
        <p style={{ color: "rgba(255,255,255,.7)" }}>
          {fromClaim
            ? "We verify your number or email so we can reach you about what we find, and so nobody else can see your claims."
            : "Sign in with the number or email you used when you filed."}
        </p>
        <div className="foot">
          <div className="lbl">{caps.emailCode ? "No passwords. We send a six-digit code each time." : "No passwords. A code by SMS, or a sign-in link by email."}</div>
        </div>
      </aside>
      <main className="wiz-right">
        <div className="bar"><Link className="backlink" href="/">Back to home</Link><span /></div>
        <div className="wiz-body">
          <div className="wiz-content">
            {stage === "enter" ? (
              <>
                <h1>Sign in</h1>
                <p>Use your phone or your email. Both work, pick whichever you check more.</p>
                <div className="segmented" role="group" aria-label="Sign-in method">
                  <button type="button" aria-pressed={method === "phone"} onClick={() => { setMethod("phone"); setIdentifier(""); setError(null); }}>Phone</button>
                  <button type="button" aria-pressed={method === "email"} onClick={() => { setMethod("email"); setIdentifier(""); setError(null); }}>Email</button>
                </div>
                {method === "phone" ? (
                  <>
                    <TextField label="Mobile number" value={identifier} onChange={setIdentifier} placeholder="0803 123 4567"
                      type="tel" inputMode="tel" autoComplete="tel" error={error ?? undefined} />
                    {caps.whatsapp && (
                      <div className="field">
                        <span className="label">Send the code by</span>
                        <div className="segmented" role="group" aria-label="Code delivery">
                          <button type="button" aria-pressed={phoneChannel === "whatsapp"} onClick={() => setPhoneChannel("whatsapp")}>WhatsApp</button>
                          <button type="button" aria-pressed={phoneChannel === "sms"} onClick={() => setPhoneChannel("sms")}>SMS</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <TextField label="Email address" value={identifier} onChange={setIdentifier} placeholder="you@example.com"
                    type="email" inputMode="email" autoComplete="email" error={error ?? undefined}
                    hint={caps.emailCode ? "We send a six-digit code and a sign-in link. Use whichever arrives first." : "We email you a sign-in link. Open it on this device."} />
                )}
                <button className="btn lg" onClick={send} disabled={busy || !identifier.trim()}>
                  {busy ? <span className="spin" /> : method === "email" && !caps.emailCode ? "Email me a sign-in link" : "Send my code"}
                </button>
              </>
            ) : linkOnly ? (
              <>
                <h1>Check your email</h1>
                <p>We sent a sign-in link to <b>{sentTo}</b>. Open it on this device and you&apos;ll land back here, signed in.</p>
                <p style={{ color: "var(--ink-3)" }}>Nothing after a couple of minutes? Check spam, or send it again.</p>
                <div className="btn-row">
                  <button className="link" onClick={() => { setStage("enter"); setError(null); }}>Use a different email</button>
                  <button className="link" onClick={send} disabled={busy}>Send the link again</button>
                </div>
                {error && <div className="field-error">{error}</div>}
              </>
            ) : (
              <>
                <h1>Enter your code</h1>
                <p>We sent a six-digit code to <b>{sentTo}</b> by {via}.</p>
                <TextField label="Six-digit code" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" inputMode="numeric" autoComplete="one-time-code" maxLength={6} error={error ?? undefined}
                  hint={DATA_SOURCE === "mock" ? `Demo mode: the code is ${MOCK_OTP}.` : undefined} />
                <div className="btn-row">
                  <button className="btn lg" onClick={verify} disabled={busy || code.length !== 6}>
                    {busy ? <span className="spin" /> : "Verify and continue"}
                  </button>
                  <button className="link" onClick={() => { setStage("enter"); setCode(""); setError(null); }}>Use a different {method}</button>
                  <button className="link" onClick={send} disabled={busy}>Resend</button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
