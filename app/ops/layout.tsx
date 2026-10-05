"use client";

import type { ReactNode } from "react";
import { AppBar } from "@/components/AppBar";
import { RequireAuth } from "@/components/RequireAuth";

export default function OpsLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth role="ops">
      <AppBar />
      <main className="appmain">{children}</main>
    </RequireAuth>
  );
}
