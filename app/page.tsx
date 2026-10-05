import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-top">
          <Logo height={32} onDark />
          <Link className="signin" href="/sign-in?next=/dashboard">Sign in to track a claim</Link>
        </div>
        <div className="hero-grid">
          <div className="hero-main">
            <h1>Your dividends didn&apos;t disappear. They&apos;re waiting.</h1>
            <p>
              Old share certificates, a bank account you closed, a name spelled three different ways. We search every
              Nigerian registrar, file the claim under your authority, and chase it until the money lands in your account.
            </p>
            <div className="hero-cta">
              <Link className="btn gold lg" href="/claim/start/own">Check what you&apos;re owed</Link>
              <Link className="btn ghost on-dark lg" href="/claim/start/estate">Claiming for someone who has died</Link>
            </div>
            <div className="hero-note">10% of what we recover. Nothing if we recover nothing.</div>
          </div>
          <div className="hero-stat">
            <div className="sum">{"\u20A6"}242bn</div>
            <div className="lbl">in dividends sitting unclaimed with Nigerian registrars</div>
            <div className="src">Source: Securities and Exchange Commission, Nigeria</div>
          </div>
        </div>
      </section>

      <section className="strip">
        <h2>How it works</h2>
        <div className="strip-grid">
          <div className="strip-item">
            <div className="n">1</div>
            <h3>Give us your names</h3>
            <p>Every spelling you&apos;ve used: maiden names, initials, the version on an old share certificate. Registers rarely match your ID exactly.</p>
          </div>
          <div className="strip-item">
            <div className="n">2</div>
            <h3>See what&apos;s owed</h3>
            <p>We search all 21 registrars in one pass and show every dividend we find, company by company, before you commit to anything.</p>
          </div>
          <div className="strip-item">
            <div className="n">3</div>
            <h3>We do the chasing</h3>
            <p>A person here reviews every claim before it goes out. We file, follow up every two weeks, and the registrar pays you directly.</p>
          </div>
        </div>
      </section>

      <section className="trust">
        <div><div className="k">21</div><div className="v">Registrars searched in every claim</div></div>
        <div><div className="k">{"\u20A6"}0</div><div className="v">Held by us. Money goes from the registrar to your account</div></div>
        <div><div className="k">10%</div><div className="v">Maximum fee, debited only after you&apos;re paid</div></div>
      </section>
      <p className="foot-note tiny">
        Dividendi acts on a limited power of attorney scoped to each claim. You can claim directly from any registrar at no
        cost, and we tell you how before you sign.
      </p>
    </>
  );
}
