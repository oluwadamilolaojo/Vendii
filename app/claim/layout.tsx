"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { OPEN_CLAIM_PATHS } from "@/lib/wizard";

/** People can type their details before signing in. Searching, signing and filing need a verified account. */
export default function ClaimLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const open = OPEN_CLAIM_PATHS.some((p) => pathname.startsWith(p));
  return open ? <>{children}</> : <RequireAuth>{children}</RequireAuth>;
}
