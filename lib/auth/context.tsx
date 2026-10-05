"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@/lib/domain/types";
import { auth } from "./index";

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    let alive = true;
    auth.getSession()
      .then((session) => alive && setState({ session, loading: false }))
      .catch(() => alive && setState({ session: null, loading: false }));
    const off = auth.onChange((session) => alive && setState({ session, loading: false }));
    return () => {
      alive = false;
      off();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
