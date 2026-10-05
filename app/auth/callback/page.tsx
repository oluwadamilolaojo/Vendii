"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/auth";
import { useAuth } from "@/lib/auth/context";
import { errorMessage } from "@/lib/util";

/** Landing page for email sign-in links. Finishes the sign-in from the URL, then sends the shareholder on. */
export default function AuthCallback() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !auth.completeLink) return;
    started.current = true;
    auth.completeLink(window.location.href)
      .then((s) => { if (s) router.replace("/dashboard"); })
      .catch((e) => setError(errorMessage(e)));
  }, [router]);

  useEffect(() => {
    if (error) return;
    if (session) router.replace("/dashboard");
    else if (!loading) {
      const t = setTimeout(() => router.replace("/sign-in?next=/dashboard"), 6000);
      return () => clearTimeout(t);
    }
  }, [session, loading, router, error]);

  return (
    <div className="center-note">
      {error ? (
        <div>
          <p>{error}</p>
          <p><a className="link" href="/sign-in?next=/dashboard">Back to sign in</a></p>
        </div>
      ) : (
        <div><span className="spin" /><p style={{ marginTop: 12 }}>Signing you in</p></div>
      )}
    </div>
  );
}
