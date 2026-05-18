"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getSession, logout } from "../../lib/api";

const NAV = [
  {
    href: "/", label: "Chat",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6l-4 4V5z" clipRule="evenodd" />
      </svg>
    ),
    accent: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-300", dot: "bg-violet-400" },
  },
  {
    href: "/dashboard", label: "Dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm8 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zM3 12a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zm8 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
    accent: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-300", dot: "bg-cyan-400" },
  },
  {
    href: "/tasks", label: "Tasks",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
    ),
    accent: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-300", dot: "bg-emerald-400" },
  },
  {
    href: "/team", label: "Team",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" />
      </svg>
    ),
    accent: { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", text: "text-fuchsia-300", dot: "bg-fuchsia-400" },
  },
  {
    href: "/blockers", label: "Blockers",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    accent: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-300", dot: "bg-rose-400" },
  },
  {
    href: "/profile", label: "Profile",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    ),
    accent: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-300", dot: "bg-amber-400" },
  },
];

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState(null);

  useEffect(() => {
    const s = getSession();
    if (!s.token) { router.replace("/login"); return; }
    setSession(s);
  }, [router]);

  if (!session) return null;

  function isActive(href) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen flex bg-[#0c0c0f]">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 flex flex-col sticky top-0 h-screen bg-[#111116] border-r border-white/[0.05]">

        {/* Logo */}
        <div className="px-4 pt-5 pb-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-violet-900/30">
              P
            </div>
            <div>
              <div className="text-sm font-semibold text-white tracking-tight leading-none">Productivity</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">Tracker</div>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(n => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                  ${active
                    ? `${n.accent.bg} ${n.accent.text} border ${n.accent.border}`
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                  }`}
              >
                <span className={`flex-shrink-0 transition-opacity ${active ? "" : "opacity-50 group-hover:opacity-80"}`}>
                  {n.icon}
                </span>
                <span className="flex-1">{n.label}</span>
                {active && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.accent.dot}`} />}
              </Link>
            );
          })}
        </nav>

        {/* User + Sign out */}
        <div className="px-2.5 py-3 border-t border-white/[0.05] space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center text-[11px] font-bold text-zinc-300 flex-shrink-0">
              {session.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-zinc-300 truncate">{session.name}</div>
              <div className="text-[10px] text-zinc-600 capitalize">{session.role}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-zinc-600 hover:text-rose-400 hover:bg-rose-500/[0.07] transition-all duration-200 border border-transparent hover:border-rose-900/40"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h6a1 1 0 100-2H4V5h5a1 1 0 100-2H3zm10.293 4.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L14.586 11H8a1 1 0 110-2h6.586l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 p-6 overflow-auto">{children}</main>
    </div>
  );
}
