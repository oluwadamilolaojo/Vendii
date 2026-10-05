"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/WizardShell";
import { useDraft } from "@/lib/draft";
import { naira } from "@/lib/domain/fees";

export default function FiledStep() {
  const { draft, reset } = useDraft();
  const router = useRouter();
  const selected = draft.candidates.filter((c) => draft.selectedIds.includes(c.id) && c.pocket === "registrar");
  const held = draft.candidates.filter((c) => c.pocket === "uftf");
  const total = selected.reduce((s, c) => s + c.amount, 0);

  const finish = () => {
    reset();
    router.push("/dashboard");
  };

  if (draft.filedIds.length === 0) {
    return (
      <WizardShell phase={3} stepLabel="Filed">
        <h1>Nothing new was filed</h1>
        <p>These claims may already be open on your account.</p>
        <Link className="btn" href="/dashboard">See my claims</Link>
      </WizardShell>
    );
  }

  return (
    <WizardShell phase={3} stepLabel="Filed" footer={<button className="btn lg" onClick={finish}>Track my claims</button>}>
      <h1>Your claims are in</h1>
      <p>
        {selected.length} claim{selected.length === 1 ? "" : "s"} worth an estimated <b>{naira(total)}</b>, across{" "}
        {new Set(selected.map((c) => c.registrar)).size} registrar{new Set(selected.map((c) => c.registrar)).size === 1 ? "" : "s"}.
      </p>
      <h2>What happens next</h2>
      <div className="ledger">
        <div className="row"><span className="k">Within 2 working days</span><span className="v">A person here reviews every pack</span></div>
        <div className="row"><span className="k">Within a week</span><span className="v">Filed, and the registrar confirms receipt</span></div>
        <div className="row"><span className="k">Every two weeks</span><span className="v">We check status and update you</span></div>
        <div className="row"><span className="k">When paid</span><span className="v">Money lands in {draft.bankName}</span></div>
      </div>
      {held.length > 0 && (
        <div className="banner gold" style={{ marginTop: 18 }}>
          <b>{held.length} held for later</b>
          We&apos;re tracking {held.map((c) => c.company).join(", ")} and will file when the six-year route opens.
        </div>
      )}
    </WizardShell>
  );
}
