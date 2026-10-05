"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Claim, ContactDetails, FlowType, PersonName } from "@/lib/domain/types";

export interface AdministratorDraft {
  name: PersonName;
  relationship: string;
  phone: string;
  email: string;
  address: string;
  photo: string | null;
  probateDocName: string | null;
  probateDocPath: string | null;
}

/** Everything typed during onboarding. Lives in the browser until it's filed. */
export interface Draft {
  flowType: FlowType;
  name: PersonName;
  variants: string[];
  bvn: string;
  nin: string;
  chn: string;
  address: string;
  contact: ContactDetails;
  photo: string | null;
  administrator: AdministratorDraft;
  bankName: string;
  accountNumber: string;
  candidates: Claim[];
  selectedIds: string[];
  poaAcks: boolean[];
  signature: string | null;
  mandateAcks: boolean[];
  filedIds: string[];
}

const emptyName = (): PersonName => ({ first: "", middle: "", last: "" });

export function emptyDraft(flowType: FlowType = "own"): Draft {
  return {
    flowType,
    name: emptyName(),
    variants: [],
    bvn: "",
    nin: "",
    chn: "",
    address: "",
    contact: { city: "", state: "", previousAddress: "", phone: "", email: "" },
    photo: null,
    administrator: {
      name: emptyName(), relationship: "", phone: "", email: "", address: "",
      photo: null, probateDocName: null, probateDocPath: null,
    },
    bankName: "",
    accountNumber: "",
    candidates: [],
    selectedIds: [],
    poaAcks: [false, false, false],
    signature: null,
    mandateAcks: [false, false],
    filedIds: [],
  };
}

/** Sample details for demos. Only reachable from the mock-mode demo tools. */
export function sampleDraft(flowType: FlowType): Partial<Draft> {
  if (flowType === "estate") {
    return {
      name: { first: "Folasade", middle: "Adunni", last: "Ogunyemi" },
      variants: ["F. A. Ogunyemi", "Folasade Ogunyemi", "Folasade Adunni Bakare"],
      address: "7 Allen Avenue, Ikeja, Lagos",
      contact: { city: "Ikeja", state: "Lagos", previousAddress: "", phone: "0803 123 4567", email: "adewale@example.com" },
      administrator: {
        name: { first: "Adewale", middle: "Bamidele", last: "Ogunyemi" },
        relationship: "Child", phone: "0803 123 4567", email: "adewale@example.com",
        address: "14 Bourdillon Close, Ikoyi, Lagos", photo: null,
        probateDocName: "Letters_of_Administration_Lagos_HC.pdf",
        probateDocPath: "mock://probate/Letters_of_Administration_Lagos_HC.pdf",
      },
      bankName: "Guaranty Trust Bank",
      accountNumber: "0123456213",
    };
  }
  return {
    name: { first: "Adewale", middle: "Bamidele", last: "Ogunyemi" },
    variants: ["A. B. Ogunyemi", "Adewale B. Ogunyemi", "Adewale Ogunyemi"],
    bvn: "22154874718",
    nin: "40218879034",
    address: "14 Bourdillon Close, Ikoyi, Lagos",
    contact: { city: "Ikoyi", state: "Lagos", previousAddress: "22 Awolowo Road, Ikoyi, Lagos", phone: "0803 123 4567", email: "adewale@example.com" },
    bankName: "Guaranty Trust Bank",
    accountNumber: "0123456213",
  };
}

const KEY = "dividendi:v1:draft";

type Patch = Partial<Draft> | ((d: Draft) => Partial<Draft>);

interface DraftState {
  draft: Draft;
  ready: boolean;
  update: (patch: Patch) => void;
  reset: (flowType?: FlowType) => void;
}

const DraftContext = createContext<DraftState | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Draft>;
        const base = emptyDraft(saved.flowType ?? "own");
        setDraft({ ...base, ...saved, administrator: { ...base.administrator, ...(saved.administrator ?? {}) }, contact: { ...base.contact, ...(saved.contact ?? {}) } });
      }
    } catch {
      /* start fresh if storage is unreadable */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      /* storage full (large photo); the draft still works for this session */
    }
  }, [draft, ready]);

  const update = useCallback((patch: Patch) => {
    setDraft((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));
  }, []);

  const reset = useCallback((flowType: FlowType = "own") => setDraft(emptyDraft(flowType)), []);

  const value = useMemo(() => ({ draft, ready, update, reset }), [draft, ready, update, reset]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftState {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used inside DraftProvider");
  return ctx;
}
