"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/context";
import type { Role } from "@/lib/domain/types";

export function RequireAuth({ children, role }: { children: ReactNode; role?: Role }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [loading, session, pathname, router]);

  if (loading || !session) {
    return <div className="center-note"><span className="spin" aria-label="Loading" /></div>;
  }
  if (role && session.role !== role) {
    return (
      <div className="center-note">
        <div>
          <h2>This area is for Dividendi staff</h2>
          <p>You&apos;re signed in as {session.identifier}.</p>
          <Link className="btn" href="/dashboard">Go to my claims</Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
