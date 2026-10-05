"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/context";
import { repo } from "@/lib/data";
import type { OpsAction } from "@/lib/domain/actions";
import { DEFAULT_SETTINGS } from "@/lib/domain/settings";
import type { Actor, Claim, Settings, StaffMember } from "@/lib/domain/types";
import { errorMessage } from "@/lib/util";

interface OpsState {
  me: Actor | null;
  claims: Claim[] | null;
  staff: StaffMember[];
  settings: Settings;
  error: string | null;
  /** Runs an action and swaps the updated claim into the shared list. Throws on refusal. */
  act(id: string, action: OpsAction): Promise<Claim>;
  bulk(ids: string[], action: OpsAction): Promise<{ done: number; failed: { id: string; error: string }[] }>;
  replace(c: Claim): void;
  reload(): Promise<void>;
  setSettings(s: Settings): void;
}

const Ctx = createContext<OpsState | null>(null);

/** Loads claims, the team and settings once for every admin page, and keeps them in step. */
export function OpsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [c, s, st] = await Promise.all([repo.ops.listAll(), repo.ops.staff().catch(() => []), repo.ops.settings().catch(() => DEFAULT_SETTINGS)]);
      setClaims(c); setStaff(s); setSettings(st); setError(null);
    } catch (e) {
      setError(errorMessage(e)); setClaims([]);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const replace = useCallback((c: Claim) => setClaims((cs) => (cs ?? []).map((x) => (x.id === c.id ? c : x))), []);

  const value = useMemo<OpsState>(() => ({
    me: session ? { id: session.userId, name: session.name ?? session.identifier, role: session.role } : null,
    claims, staff, settings, error,
    async act(id, action) {
      const c = await repo.ops.act(id, action);
      replace(c);
      return c;
    },
    async bulk(ids, action) {
      const r = await repo.ops.bulk(ids, action);
      setClaims((cs) => (cs ?? []).map((x) => r.done.find((d) => d.id === x.id) ?? x));
      return { done: r.done.length, failed: r.failed };
    },
    replace, reload, setSettings,
  }), [session, claims, staff, settings, error, replace, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOps(): OpsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOps must be used inside the admin layout.");
  return v;
}
