"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/context";
import { can, isStaff, type Permission } from "@/lib/domain/permissions";

/** Signed in, and optionally staff, or staff with a specific permission. */
export function RequireAuth({ children, staff, permission }: { children: ReactNode; staff?: boolean; permission?: Permission }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [loading, session, pathname, router]);

  if (loading || !session) {
    return <div className="center-note"><span className="spin" aria-label="Loading" /></div>;
  }
  if ((staff || permission) && !isStaff(session.role)) {
    return (
      <div className="center-note">
        <div>
          <h2>This area is for Vendii staff</h2>
          <p>You&apos;re signed in as {session.identifier}.</p>
          <Link className="btn" href="/dashboard">Go to my claims</Link>
        </div>
      </div>
    );
  }
  if (permission && !can(session.role, permission)) {
    return (
      <div className="empty">
        <h2>Your role can&apos;t open this page</h2>
        <p>Ask an admin if you need it.</p>
        <Link className="btn" href="/ops">Back to the queue</Link>
      </div>
    );
  }
  return <>{children}</>;
}
