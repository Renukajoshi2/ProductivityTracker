"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getSession, logout } from "../../lib/api";

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState(null);

  useEffect(() => {
    const s = getSession();
    if (!s.token) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [router]);

  if (!session) return null;

  const isLead = session.role === "admin" || session.role === "lead";
  const nav = [
    { href: "/", label: "Chat" },
    ...(isLead
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/team", label: "Team" },
        ]
      : []),
    { href: "/blockers", label: "Blockers" },
    { href: "/profile", label: "Profile" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-800 px-6 py-3 flex items-center gap-6">
        <span className="font-semibold text-indigo-400">⚡ Productivity</span>
        <nav className="flex gap-4 text-sm flex-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={
                pathname === n.href
                  ? "text-white font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <span className="text-sm text-slate-400">
          {session.name} ({session.role})
        </span>
        <button
          onClick={logout}
          className="text-sm text-slate-400 hover:text-red-400"
        >
          Logout
        </button>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
