"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { mockSignInAs } from "@/lib/auth/mock";
import { DATA_SOURCE, MOCK_OTP, OPS_EMAILS } from "@/lib/config";
import { mockRepository } from "@/lib/data";
import { sampleDraft, useDraft } from "@/lib/draft";

/** Mock mode only. Shortcuts for demos: never shown when DATA_SOURCE is "firebase". */
export function DemoTools() {
  if (DATA_SOURCE !== "mock") return null;
  return <DemoToolsPanel />;
}

function DemoToolsPanel() {
  const [open, setOpen] = useState(false);
  const { draft, update } = useDraft();
  const router = useRouter();
  const pathname = usePathname();
  const inWizard = pathname.startsWith("/claim/");

  const go = (href: string) => { setOpen(false); router.push(href); };

  return (
    <>
      {open && (
        <div className="demo-panel" role="dialog" aria-label="Demo tools">
          <h3>Demo tools</h3>
          <p className="tiny">Mock mode. Nothing leaves this browser. One-time code is {MOCK_OTP}.</p>
          {inWizard && (
            <button className="btn quiet sm" onClick={() => { update(sampleDraft(draft.flowType)); setOpen(false); }}>
              Fill sample {draft.flowType === "estate" ? "estate" : "shareholder"} details
            </button>
          )}
          <button className="btn quiet sm" onClick={() => { mockSignInAs("+2348031234567", "phone"); mockRepository.loadSampleHistory(); go("/dashboard"); }}>
            Sign in with sample claim history
          </button>
          <button className="btn quiet sm" onClick={() => { mockSignInAs(OPS_EMAILS[0] ?? "ops@dividendi.ng", "email"); go("/ops"); }}>
            Sign in as ops staff
          </button>
          <button className="btn quiet sm" onClick={() => {
            Object.keys(window.localStorage).filter((k) => k.startsWith("dividendi:")).forEach((k) => window.localStorage.removeItem(k));
            window.location.href = "/";
          }}>
            Reset all demo data
          </button>
          <button className="btn quiet sm" onClick={() => {
            const el = document.documentElement;
            el.setAttribute("data-theme", el.getAttribute("data-theme") === "dark" ? "light" : "dark");
          }}>
            Toggle dark mode
          </button>
        </div>
      )}
      <button className="demo-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Demo</button>
    </>
  );
}
