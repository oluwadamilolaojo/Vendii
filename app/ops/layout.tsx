"use client";

import type { ReactNode } from "react";
import { AppBar } from "@/components/AppBar";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminNav } from "@/components/ops/AdminNav";
import { OpsProvider } from "@/lib/ops/context";

export default function OpsLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth staff>
      <AppBar />
      <main className="appmain">
        <OpsProvider>
          <AdminNav />
          {children}
        </OpsProvider>
      </main>
    </RequireAuth>
  );
}
