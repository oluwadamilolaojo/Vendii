"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WizardShell } from "@/components/WizardShell";
import { TickIcon } from "@/components/icons";
import { repo } from "@/lib/data";
import { useDraft } from "@/lib/draft";
import { fullName } from "@/lib/domain/names";
import { errorMessage } from "@/lib/util";

const SOURCES = [
  "SEC Nigeria unclaimed dividend records",
  "Africa Prudential, Apel, Atlas, CardinalStone",
  "Carnation, Centurion, Cordros, Coronation",
  "Datamax, EDC, First Registrars, Flour Mills",
  "Greenwich, Lancelot, Lighthouse, MainstreetBank",
  "Meristem, PAC, Pace, Unity, Veritas",
  "CSCS holdings on your CHN",
];

export default function SearchStep() {
  const { draft, ready, update } = useDraft();
  const router = useRouter();
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const spellings = [fullName(draft.name), ...draft.variants].filter(Boolean);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setDone(0);
    setError(null);
    const gap = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 460;
    const timer = setInterval(() => setDone((d) => Math.min(d + 1, SOURCES.length)), gap);
    const minimum = new Promise((r) => setTimeout(r, gap * (SOURCES.length + 1)));

    Promise.all([
      repo.searchRegisters({ name: draft.name, variants: draft.variants, bvn: draft.bvn, nin: draft.nin, chn: draft.chn }),
      minimum,
    ])
      .then(([candidates]) => {
        if (cancelled) return;
        clearInterval(timer);
        update({ candidates, selectedIds: candidates.filter((c) => c.pocket === "registrar").map((c) => c.id) });
        router.replace("/claim/results");
      })
      .catch((e) => {
        if (cancelled) return;
        clearInterval(timer);
        setError(errorMessage(e));
      });

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, attempt]);

  const current = spellings[Math.min(Math.floor(done / 2), spellings.length - 1)] ?? "";

  return (
    <WizardShell phase={1} stepLabel="Searching">
      <h1>Searching every register</h1>
      <p>Checking {spellings.length} spelling{spellings.length === 1 ? "" : "s"} against all 21 registrars.</p>
      {error ? (
        <div className="banner red">
          <b>The search didn&apos;t finish</b>
          {error}
          <div style={{ marginTop: 10 }}><button className="btn sm" onClick={() => setAttempt((a) => a + 1)}>Try again</button></div>
        </div>
      ) : (
        <>
          <div className="tiny" style={{ marginBottom: 10 }}>Trying <b>{current}</b></div>
          <div role="status" aria-live="polite">
            {SOURCES.map((s, i) => (
              <div key={s} className="sweep-line" data-on={i <= done}>
                <span className={i < done ? "dot on" : "dot"}>{i < done ? <TickIcon size={10} /> : null}</span>
                <span style={{ flex: 1 }}>{s}</span>
                {i === done && <span className="spin" />}
              </div>
            ))}
          </div>
        </>
      )}
    </WizardShell>
  );
}
