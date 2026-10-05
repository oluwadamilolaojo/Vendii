"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/auth";
import { useAuth } from "@/lib/auth/context";
import { Logo } from "./Logo";

export function AppBar() {
  const { session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const links = [{ href: "/dashboard", label: "My claims" }, { href: "/forms", label: "Registrar forms" }];
  if (session?.role === "ops") links.push({ href: "/ops", label: "Ops console" });

  return (
    <header className="appbar">
      <Link href="/" aria-label="Dividendi home"><Logo height={22} /></Link>
      <nav>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="navlink" data-on={pathname.startsWith(l.href)}>{l.label}</Link>
        ))}
        <Link href="/claim/start/own" className="navlink">Start a claim</Link>
      </nav>
      <span className="spacer" />
      {session && (
        <>
          <span className="who">{session.identifier}</span>
          <button className="btn ghost sm" onClick={async () => { await auth.signOut(); router.push("/"); }}>Sign out</button>
        </>
      )}
    </header>
  );
}
