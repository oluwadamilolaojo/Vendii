"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { ROLE_LABEL, can, type Permission } from "@/lib/domain/permissions";

const ROOMS: { href: string; label: string; need: Permission; exact?: boolean }[] = [
  { href: "/ops", label: "Queue", need: "queue.view", exact: true },
  { href: "/ops/registrars", label: "Registrars", need: "queue.view" },
  { href: "/ops/money", label: "Money", need: "money.manage" },
  { href: "/ops/team", label: "Team", need: "team.manage" },
  { href: "/ops/audit", label: "Audit log", need: "audit.view" },
  { href: "/ops/settings", label: "Settings", need: "settings.edit" },
];

/** Each role sees only the rooms it can use. The routes enforce the same thing on the server. */
export function AdminNav() {
  const { session } = useAuth();
  const path = usePathname();
  const rooms = ROOMS.filter((r) => can(session?.role, r.need));
  return (
    <nav className="subnav" aria-label="Admin">
      {rooms.map((r) => {
        const on = r.exact ? path === r.href || path.startsWith("/ops/claims") : path.startsWith(r.href);
        return <Link key={r.href} href={r.href} data-on={on}>{r.label}</Link>;
      })}
      {session && <span className="who">{session.name ?? session.identifier} · {ROLE_LABEL[session.role]}</span>}
    </nav>
  );
}
