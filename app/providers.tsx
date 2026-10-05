"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/context";
import { DraftProvider } from "@/lib/draft";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DraftProvider>{children}</DraftProvider>
    </AuthProvider>
  );
}
