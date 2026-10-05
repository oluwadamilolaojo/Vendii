"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useDraft } from "@/lib/draft";
import { BackIcon } from "./icons";
import { Logo } from "./Logo";

const PHASES = [
  { t: "Tell us who is owed", d: "Names, identity numbers, and the account the money goes back to." },
  { t: "We search the registers", d: "Every registrar, every spelling of the name, in one pass." },
  { t: "You authorize the claim", d: "A scoped power of attorney and the fee mandate, signed once." },
  { t: "We chase it down", d: "Human review, filing, status checks, and payout straight to the account." },
];

interface Props {
  phase: 0 | 1 | 2 | 3;
  stepLabel: string;
  backHref?: string;
  wide?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

export function WizardShell({ phase, stepLabel, backHref, wide, footer, children }: Props) {
  const { ready } = useDraft();
  return (
    <div className="wizshell">
      <aside className="wiz-left">
        <Link href="/" className="wiz-mark" aria-label="Dividendi home"><Logo height={30} onDark /></Link>
        <ol className="wiz-phase" aria-label="Progress">
          {PHASES.map((p, i) => {
            const s = i < phase ? "done" : i === phase ? "now" : "wait";
            return (
              <li key={p.t} className="ph" data-s={s} aria-current={s === "now" ? "step" : undefined}>
                <span className="dot">{s === "done" ? "\u2713" : i + 1}</span>
                <div><div className="t">{p.t}</div><div className="d">{p.d}</div></div>
              </li>
            );
          })}
        </ol>
        <div className="foot">
          <div className="stat">{"\u20A6"}242bn</div>
          <div className="lbl">Sitting unclaimed with Nigerian registrars, SEC Nigeria estimate</div>
        </div>
      </aside>
      <main className="wiz-right">
        <div className="bar">
          {backHref ? <Link className="backlink" href={backHref}><BackIcon />Back</Link> : <span />}
          <span className="steplabel">{stepLabel}</span>
        </div>
        <div className="wiz-body">
          {ready && (
            <>
              <div className={wide ? "wiz-content wide" : "wiz-content"}>{children}</div>
              {footer && <div className={wide ? "wiz-foot wide" : "wiz-foot"}>{footer}</div>}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
