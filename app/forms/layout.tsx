"use client";

import type { ReactNode } from "react";
import { AppBar } from "@/components/AppBar";
import { RequireAuth } from "@/components/RequireAuth";

export default function FormsLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppBar />
      <main className="appmain">{children}</main>
    </RequireAuth>
  );
}
