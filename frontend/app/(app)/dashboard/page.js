"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart, Pie, Cell, Sector, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { api } from "../../../lib/api";

// ── Tiny SVG Sparkline ────────────────────────────────────────────────────────
function Sparkline({ data = [], color = "#34d399", w = 56, h = 22 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={color}
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, badge, sparkData, color = "#34d399", onClick }) {
  return (
    <div
      onClick={onClick}
      className={`relative bg-[#111116]/90 backdrop-blur-sm border border-white/[0.07] rounded-2xl p-4 overflow-hidden group hover:border-violet-500/30 transition-all duration-150 ${onClick ? "cursor-pointer hover:scale-[1.03] active:scale-[1.12] active:border-violet-500/60 active:shadow-lg active:shadow-violet-900/40" : ""}`}
    >
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-[0.07] group-hover:opacity-[0.13] transition-opacity duration-500"
        style={{ background: color }} />
      <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-2">{label}</div>
      <div className="text-3xl font-bold text-white leading-none">{value ?? "—"}</div>
      {sub && <div className="text-xs text-zinc-600 mt-1">{sub}</div>}
      <div className="flex items-end justify-between mt-3 gap-2">
        {badge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.text}</span>}
        {sparkData && <Sparkline data={sparkData} color={color} w={60} h={24} />}
      </div>
      {onClick && <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity text-[10px] text-white">↗</div>}
    </div>
  );
}

// ── Team Overview Card ────────────────────────────────────────────────────────
function TeamCard({ activeTeam, oooMembers, onClick, className = "" }) {
  const total = activeTeam.length + oooMembers.length;
  return (
    <div
      onClick={onClick}
      className={`relative bg-[#111116]/80 backdrop-blur-sm border border-white/[0.07] rounded-2xl p-5 overflow-hidden group hover:border-violet-500/20 transition-all duration-300 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-[0.04] bg-emerald-400" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Team Overview</h2>
        {onClick && <span className="opacity-0 group-hover:opacity-40 transition-opacity text-[10px] text-white">↗</span>}
      </div>

      {/* Stat row */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 bg-[#0c0c0f]/60 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-white leading-none">{total}</div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">Total</div>
        </div>
        <div className="flex-1 bg-[#0c0c0f]/60 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400 leading-none">{activeTeam.length}</div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">Active</div>
        </div>
        <div className="flex-1 bg-[#0c0c0f]/60 rounded-xl p-3 text-center">
          <div className={`text-2xl font-bold leading-none ${oooMembers.length > 0 ? "text-amber-400" : "text-zinc-600"}`}>
            {oooMembers.length}
          </div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">OOO</div>
        </div>
      </div>

      {/* OOO names or full-capacity */}
      {oooMembers.length > 0 ? (
        <div>
          <div className="text-[10px] text-amber-400/70 font-semibold uppercase tracking-wider mb-2">Out of Office</div>
          <div className="flex flex-wrap gap-1.5">
            {oooMembers.map(m => (
              <span key={m.name} className="text-xs bg-amber-500/10 text-amber-300 border border-amber-700/30 px-2.5 py-0.5 rounded-full">
                {m.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center pt-1">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-700/30">
            ✓ Full capacity
          </span>
        </div>
      )}
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
const EVENT_STYLES = {
  milestone: { dot: "bg-violet-400",  label: "Milestone", text: "text-violet-200",  bg: "bg-violet-500/20"  },
  deadline:  { dot: "bg-amber-400",   label: "Deadline",  text: "text-amber-200",   bg: "bg-amber-500/20"   },
  release:   { dot: "bg-cyan-400",    label: "Release",   text: "text-cyan-200",    bg: "bg-cyan-500/20"    },
  demo:      { dot: "bg-fuchsia-400", label: "Demo",      text: "text-fuchsia-200", bg: "bg-fuchsia-500/20" },
};

function CalendarView() {
  const [cal, setCal] = useState(() => {
    const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [events, setEvents] = useState([]);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    api("/calendar/events").then(setEvents).catch(() => {});
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const eventMap = useMemo(() => {
    const map = {};
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  const { y, m } = cal;
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthLabel = new Date(y, m).toLocaleString("en-US", { month: "long", year: "numeric" });

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function dateStr(day) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Calendar</h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">Events added by leads via chat</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCal(p => { const d = new Date(p.y, p.m - 1); return { y: d.getFullYear(), m: d.getMonth() }; })}
            className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#16161f] rounded-lg transition-colors">‹</button>
          <span className="text-xs font-medium text-white w-32 text-center">{monthLabel}</span>
          <button
            onClick={() => setCal(p => { const d = new Date(p.y, p.m + 1); return { y: d.getFullYear(), m: d.getMonth() }; })}
            className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#16161f] rounded-lg transition-colors">›</button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-zinc-600 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[72px]" />;
          const ds = dateStr(day);
          const dayEvents = eventMap[ds] || [];
          const isToday = ds === todayStr;
          return (
            <div
              key={i}
              onMouseEnter={() => setHovered(ds)}
              onMouseLeave={() => setHovered(null)}
              className={`relative flex flex-col min-h-[72px] py-1.5 px-1 rounded-lg transition-all cursor-default
                ${isToday ? "bg-violet-500/15 ring-1 ring-violet-500/40" : dayEvents.length > 0 ? "hover:bg-[#16161f]" : "hover:bg-[#111116]/40"}
              `}
            >
              {/* Day number */}
              <span className={`text-[11px] leading-none font-semibold mb-1 ${
                isToday ? "text-violet-300" : dayEvents.length > 0 ? "text-white" : "text-zinc-600"
              }`}>{day}</span>

              {/* Event pills */}
              <div className="space-y-0.5 flex-1">
                {dayEvents.slice(0, 2).map((e, j) => {
                  const s = EVENT_STYLES[e.type] ?? EVENT_STYLES.milestone;
                  return (
                    <div key={j} className={`text-[9px] leading-tight truncate rounded px-1 py-[2px] ${s.bg} ${s.text}`}>
                      {e.title}
                    </div>
                  );
                })}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-zinc-600 px-1">+{dayEvents.length - 2} more</div>
                )}
              </div>

              {/* Hover tooltip for full details */}
              {hovered === ds && dayEvents.length > 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 bg-[#111116] border border-white/[0.07] rounded-xl shadow-2xl p-3 pointer-events-none">
                  <div className="text-[10px] text-zinc-400 font-semibold mb-2">{ds}</div>
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {dayEvents.map((e, j) => {
                      const s = EVENT_STYLES[e.type] ?? EVENT_STYLES.milestone;
                      return (
                        <div key={j} className="flex items-start gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${s.dot}`} />
                          <div>
                            <div className={`text-[11px] font-semibold leading-tight ${s.text}`}>{s.label}</div>
                            <div className="text-[11px] text-white leading-tight">{e.title}</div>
                            {e.description && <div className="text-[10px] text-zinc-400">{e.description}</div>}
                            {e.created_by && <div className="text-[10px] text-zinc-600">by {e.created_by}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-white/[0.05]">
        {Object.entries(EVENT_STYLES).map(([, s]) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            <span className={`text-[10px] font-medium ${s.text}`}>{s.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-400 ring-1 ring-violet-400/50" />
          <span className="text-[10px] font-medium text-violet-300">Today</span>
        </div>
      </div>
    </div>
  );
}

// ── Sprint Planning ───────────────────────────────────────────────────────────
const OWNER_PALETTE = ["#a78bfa", "#34d399", "#f472b6", "#60a5fa", "#fb923c", "#facc15", "#e879f9"];

function SprintPlanning({ tasks }) {
  // Auto-calculate sprint number and dates (2-week sprints from Mon Jan 6 2025)
  const today = new Date();
  const epoch = new Date(2025, 0, 6);
  const daysSince = Math.max(0, Math.floor((today - epoch) / 86400000));
  const sprintIdx = Math.floor(daysSince / 14);
  const sprintStart = new Date(epoch.getTime() + sprintIdx * 14 * 86400000);
  const sprintEnd   = new Date(sprintStart.getTime() + 13 * 86400000);
  const daysLeft    = Math.max(0, Math.ceil((sprintEnd - today) / 86400000));
  const sprintNum   = sprintIdx + 1;
  const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const backlog  = tasks.filter(t => t.status === "open");
  const doing    = tasks.filter(t => t.status === "in_progress" || t.status === "blocked");
  const done     = tasks.filter(t => t.status === "done");
  const total    = tasks.length;
  const pct      = total > 0 ? Math.round((done.length / total) * 100) : 0;

  // Assign a stable color per unique owner
  const ownerColors = useMemo(() => {
    const map = {};
    let idx = 0;
    tasks.forEach(t => {
      if (t.owner_name && !map[t.owner_name]) {
        map[t.owner_name] = OWNER_PALETTE[idx % OWNER_PALETTE.length];
        idx++;
      }
    });
    return map;
  }, [tasks]);

  function TaskPill({ task }) {
    const c = ownerColors[task.owner_name] || "#6b7280";
    return (
      <div className="flex items-start gap-2 p-2 rounded-lg bg-[#0c0c0f]/60 border border-white/[0.07] hover:border-[#2a2a3a] transition-colors">
        <span className="w-1.5 h-1.5 rounded-full mt-[3px] flex-shrink-0" style={{ background: c }} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-white leading-snug truncate">{task.title}</div>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: c }}>{task.owner_name || "Unassigned"}</div>
        </div>
        {task.progress_pct > 0 && task.status !== "done" && (
          <span className="text-[9px] text-zinc-600 flex-shrink-0 mt-0.5">{task.progress_pct}%</span>
        )}
      </div>
    );
  }

  const columns = [
    { label: "Backlog",     dotCls: "bg-zinc-500",    textCls: "text-zinc-400",  items: backlog },
    { label: "In Progress", dotCls: "bg-cyan-500",    textCls: "text-cyan-400",  items: doing   },
    { label: "Done",        dotCls: "bg-emerald-500", textCls: "text-emerald-400", items: done  },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Sprint Planning</h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            Sprint {sprintNum} · {fmt(sprintStart)} – {fmt(sprintEnd)}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-white">{pct}%</div>
          <div className="text-[10px] text-zinc-600">{daysLeft}d left</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/[0.07] rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Three-column board */}
      <div className="grid grid-cols-3 gap-3">
        {columns.map(col => (
          <div key={col.label}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-1.5 h-1.5 rounded-full ${col.dotCls}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${col.textCls}`}>{col.label}</span>
              <span className="ml-auto text-[10px] text-zinc-700">{col.items.length}</span>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
              {col.items.length === 0 && (
                <p className="text-[10px] text-zinc-700 italic px-1">Empty</p>
              )}
              {col.items.slice(0, 8).map((t, i) => <TaskPill key={i} task={t} />)}
              {col.items.length > 8 && (
                <p className="text-[10px] text-zinc-600 px-1">+{col.items.length - 8} more</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHead({ title, right }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {right && <div className="text-xs text-zinc-600">{right}</div>}
    </div>
  );
}

// ── AI Insight Pill ───────────────────────────────────────────────────────────
const INSIGHT = {
  danger:  { bg: "bg-red-950/50",     border: "border-red-800/40",     dot: "bg-red-400",     tx: "text-red-300" },
  warning: { bg: "bg-amber-950/50",   border: "border-amber-800/40",   dot: "bg-amber-400",   tx: "text-amber-300" },
  success: { bg: "bg-emerald-950/50", border: "border-emerald-800/40", dot: "bg-emerald-400", tx: "text-emerald-300" },
  info:    { bg: "bg-[#0f0f1a]/80",   border: "border-white/[0.05]",   dot: "bg-emerald-500", tx: "text-emerald-200" },
};
function InsightPill({ type = "info", text }) {
  const s = INSIGHT[type];
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${s.bg} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${s.dot}`} />
      <p className={`text-xs leading-relaxed ${s.tx}`}>{text}</p>
    </div>
  );
}

// ── Flash Card Modal ──────────────────────────────────────────────────────────
function FlashCardModal({ title, subtitle, items, emptyMsg = "No items to show.", onClose }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${visible ? "bg-black/70 backdrop-blur-sm" : "bg-transparent"}`}
      onClick={handleClose}
    >
      <div
        className={`bg-[#111116] border border-white/[0.07] rounded-2xl w-full max-w-md max-h-[75vh] flex flex-col shadow-2xl shadow-black/60 transition-all duration-200 ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-white/[0.07]">
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-zinc-600 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-white hover:bg-[#16161f] transition-colors text-lg leading-none ml-4 mt-0.5"
          >×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-3">
          {items.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-8">{emptyMsg}</p>
          ) : (
            <div className="space-y-1">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#16161f] transition-colors">
                  <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: item.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white leading-snug truncate">{item.label}</div>
                    {item.sub && <div className="text-xs text-zinc-600 mt-0.5 truncate">{item.sub}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-9 bg-white/[0.04] rounded-xl w-72" />
      <div className="grid grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-[#111116]/60 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-96 bg-[#111116]/60 rounded-2xl" />
        <div className="h-96 bg-[#111116]/60 rounded-2xl" />
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-72 bg-[#111116]/60 rounded-2xl" />
        <div className="h-72 bg-[#111116]/60 rounded-2xl" />
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [team,    setTeam]    = useState([]);
  const [daily,   setDaily]   = useState([]);
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,       setModal]       = useState(null);
  const [activeSlice, setActiveSlice] = useState(null);

  useEffect(() => {
    Promise.all([
      api("/stats/summary").catch(() => null),
      api("/stats/team").catch(() => []),
      api("/stats/daily").catch(() => []),
      api("/tasks").catch(() => []),
    ]).then(([s, t, d, tk]) => {
      setSummary(s);
      setTeam(Array.isArray(t) ? t : []);
      setDaily(Array.isArray(d) ? d : []);
      setTasks(Array.isArray(tk) ? tk : []);
    }).finally(() => setLoading(false));
  }, []);

  const today    = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const overdueCount = useMemo(
    () => tasks.filter(t => t.due_date && t.status !== "done" && new Date(t.due_date) < today).length,
    [tasks, today]
  );

  const oooMembers = useMemo(() => team.filter(m => m.ooo), [team]);
  const activeTeam = useMemo(() => team.filter(m => !m.ooo), [team]);

  const statusData = useMemo(() => [
    { name: "Done",        value: tasks.filter(t => t.status === "done").length,        color: "#fb923c", gradId: "sg-done"    },
    { name: "In Progress", value: tasks.filter(t => t.status === "in_progress").length, color: "#38bdf8", gradId: "sg-prog"    },
    { name: "Blocked",     value: tasks.filter(t => t.status === "blocked").length,     color: "#e879f9", gradId: "sg-blocked" },
    { name: "Open",        value: tasks.filter(t => t.status === "open").length,        color: "#818cf8", gradId: "sg-open"    },
  ].filter(d => d.value > 0), [tasks]);

  const spark = useMemo(() => daily.slice(-7).map(d => d.completed), [daily]);

  const totalTasks = tasks.length;
  const doneTasks  = tasks.filter(t => t.status === "done").length;
  const openTasks  = summary?.open_tasks      ?? 0;
  const blockers   = summary?.active_blockers ?? 0;
  const compRate   = summary?.completion_rate ?? 0;
  const todayDone  = summary?.completed_today ?? 0;

  const insights = useMemo(() => {
    const out = [];
    if (blockers > 2)
      out.push({ type: "danger",  text: `${blockers} active blockers need immediate attention — they may delay delivery.` });
    else if (blockers > 0)
      out.push({ type: "warning", text: `${blockers} blocker${blockers > 1 ? "s" : ""} active. Monitor and resolve to keep momentum.` });
    if (overdueCount > 0)
      out.push({ type: "warning", text: `${overdueCount} task${overdueCount > 1 ? "s are" : " is"} overdue. Consider reassigning or adjusting scope.` });
    if (compRate >= 70)
      out.push({ type: "success", text: `Completion rate of ${compRate}% is healthy — team is on track.` });
    if (todayDone > 0)
      out.push({ type: "success", text: `${todayDone} task${todayDone > 1 ? "s" : ""} completed today — great daily progress!` });
    if (oooMembers.length > 0)
      out.push({ type: "info", text: `${oooMembers.map(m => m.name).join(", ")} ${oooMembers.length === 1 ? "is" : "are"} currently out of office.` });
    if (out.length === 0)
      out.push({ type: "info", text: "All systems look healthy. No critical issues detected this period." });
    return out.slice(0, 5);
  }, [blockers, overdueCount, compRate, todayDone, oooMembers]);

  const activity = useMemo(() =>
    tasks
      .filter(t => t.completed_at || t.first_seen)
      .sort((a, b) => new Date(b.completed_at || b.first_seen) - new Date(a.completed_at || a.first_seen))
      .slice(0, 12)
      .map(t => ({
        name:   t.owner_name,
        action: t.status === "done" ? "completed" : t.status === "blocked" ? "flagged blocker on" : "updated",
        task:   t.title,
        time:   t.completed_at || t.first_seen,
        status: t.status,
      })),
  [tasks]);

  // ── Modal openers ──────────────────────────────────────────────────────────
  function statusColor(s) {
    if (s === "done") return "#10b981";
    if (s === "blocked") return "#ef4444";
    if (s === "in_progress") return "#06b6d4";
    return "#3d5a4a";
  }

  function openTotalTasks() {
    setModal({
      title: "Total Tasks", subtitle: `${totalTasks} tasks total`,
      items: tasks.map(t => ({
        label: t.title,
        sub: `${t.owner_name || "Unknown"} · ${t.status.replace("_", " ")}${t.progress_pct ? ` · ${t.progress_pct}%` : ""}`,
        color: statusColor(t.status),
      })),
      emptyMsg: "No tasks found.",
    });
  }

  function openCompletedToday() {
    const done = tasks.filter(t => t.completed_at && t.completed_at.startsWith(todayStr));
    setModal({
      title: "Completed Today", subtitle: `${done.length} task${done.length !== 1 ? "s" : ""} finished today`,
      items: done.map(t => ({ label: t.title, sub: t.owner_name || "Unknown", color: "#10b981" })),
      emptyMsg: "No tasks completed today yet.",
    });
  }

  function openBlockers() {
    router.push("/blockers");
  }

  function openOpenPending() {
    const open = tasks.filter(t => t.status === "open" || t.status === "in_progress");
    setModal({
      title: "Open / Pending", subtitle: `${open.length} task${open.length !== 1 ? "s" : ""} in progress or pending`,
      items: open.map(t => ({
        label: t.title,
        sub: `${t.owner_name || "Unknown"} · ${t.status.replace("_", " ")} · ${t.progress_pct || 0}%`,
        color: "#06b6d4",
      })),
      emptyMsg: "No open or pending tasks.",
    });
  }

  function openOverdue() {
    const overdue = tasks.filter(t => t.due_date && t.status !== "done" && new Date(t.due_date) < today);
    setModal({
      title: "Overdue Tasks", subtitle: `${overdue.length} task${overdue.length !== 1 ? "s" : ""} past due date`,
      items: overdue.map(t => ({
        label: t.title,
        sub: `${t.owner_name || "Unknown"} · due ${new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        color: "#f97316",
      })),
      emptyMsg: "No overdue tasks — all on schedule!",
    });
  }

  function openTeamOverview() {
    setModal({
      title: "Team Overview", subtitle: `${team.length} total member${team.length !== 1 ? "s" : ""}`,
      items: team.map(m => ({
        label: m.name,
        sub: m.ooo ? "Out of Office" : `${m.open || 0} open · ${m.done || 0} done · ${m.blocked || 0} blocked`,
        color: m.ooo ? "#f59e0b" : "#10b981",
      })),
      emptyMsg: "No team members found.",
    });
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">

      {modal && (
        <FlashCardModal
          title={modal.title} subtitle={modal.subtitle}
          items={modal.items} emptyMsg={modal.emptyMsg}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Productivity Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* KPI — 5 equal metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Tasks" value={totalTasks}
          sub={`${doneTasks} completed overall`} color="#34d399"
          badge={{ text: `${compRate}% done`, cls: "bg-emerald-500/20 text-emerald-300" }}
          onClick={openTotalTasks} />
        <KpiCard label="Completed Today" value={todayDone}
          sub="tasks finished today" color="#10b981"
          badge={todayDone > 0
            ? { text: "Active day ✓", cls: "bg-emerald-500/20 text-emerald-300" }
            : { text: "None yet",     cls: "bg-[#16161f] text-zinc-400" }}
          onClick={openCompletedToday} />
        <KpiCard label="Active Blockers" value={blockers}
          sub={blockers === 0 ? "All clear" : "need resolution"} color="#ef4444"
          badge={blockers > 0
            ? { text: "⚠ Action needed", cls: "bg-red-500/20 text-red-300" }
            : { text: "✓ Clear",         cls: "bg-emerald-500/20 text-emerald-300" }}
          onClick={openBlockers} />
        <KpiCard label="Open / Pending" value={openTasks}
          sub="in progress or pending" color="#06b6d4"
          badge={{ text: "Active", cls: "bg-cyan-500/20 text-cyan-300" }}
          onClick={openOpenPending} />
        <KpiCard label="Overdue Tasks" value={overdueCount}
          sub={overdueCount > 0 ? "past due date" : "all on schedule"} color="#f97316"
          badge={overdueCount > 0
            ? { text: `${overdueCount} overdue`, cls: "bg-orange-500/20 text-orange-300" }
            : { text: "On time ✓",              cls: "bg-emerald-500/20 text-emerald-300" }}
          onClick={openOverdue} />
      </div>

      {/* Calendar (col-span-2) + Task Status + Team Overview stacked */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-[#111116]/80 backdrop-blur-sm border border-white/[0.07] rounded-2xl p-5">
          <CalendarView />
        </div>
        <div className="flex flex-col gap-6 h-full">
          {/* Task Status — grows to fill remaining space */}
          <div className="flex-1 bg-[#111116]/80 backdrop-blur-sm border border-white/[0.07] rounded-2xl p-5 flex flex-col">
            <SectionHead title="Task Status" right={`${tasks.length} total`} />
            <div className="relative flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id="sg-done"    x1="0%" y1="0%"   x2="100%" y2="100%">
                      <stop offset="0%"   stopColor="#f43f5e" />
                      <stop offset="100%" stopColor="#fb923c" />
                    </linearGradient>
                    <linearGradient id="sg-prog"    x1="100%" y1="0%"   x2="0%"   y2="100%">
                      <stop offset="0%"   stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                    <linearGradient id="sg-blocked" x1="0%"   y1="100%" x2="100%" y2="0%">
                      <stop offset="0%"   stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#e879f9" />
                    </linearGradient>
                    <linearGradient id="sg-open"    x1="50%"  y1="100%" x2="50%"  y2="0%">
                      <stop offset="0%"   stopColor="#1e1b4b" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                    <filter id="sg-shadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="7" floodColor="#000" floodOpacity="0.6" />
                    </filter>
                  </defs>
                  <Pie
                    data={statusData} dataKey="value" nameKey="name"
                    cx="50%" cy="46%" innerRadius={62} outerRadius={90}
                    paddingAngle={3} strokeWidth={0}
                    isAnimationActive animationBegin={100}
                    animationDuration={1200} animationEasing="ease-out"
                    filter="url(#sg-shadow)"
                    activeIndex={activeSlice}
                    activeShape={(props) => (
                      <Sector
                        {...props}
                        outerRadius={props.outerRadius + 14}
                        innerRadius={props.innerRadius - 4}
                        fill={props.fill}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth={2}
                      />
                    )}
                    onMouseEnter={(_, i) => setActiveSlice(i)}
                    onMouseLeave={() => setActiveSlice(null)}
                  >
                    {statusData.map(d => (
                      <Cell key={d.name} fill={`url(#${d.gradId})`} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, n) => [`${v} tasks`, n]}
                    contentStyle={{
                      background: "#111116", border: "1px solid #27272a",
                      borderRadius: 10, fontSize: 12, color: "#e4e4e7",
                    }}
                    itemStyle={{ color: "#e4e4e7" }}
                  />
                  <Legend
                    iconType="circle" iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
                    formatter={(value, entry) => (
                      <span style={{ color: entry.payload.color }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centre label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ paddingBottom: 36 }}>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white leading-none">{tasks.length}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-wide">tasks</div>
                </div>
              </div>
            </div>
          </div>
          {/* TeamCard — compact, natural height */}
          <TeamCard activeTeam={activeTeam} oooMembers={oooMembers} onClick={openTeamOverview} />
        </div>
      </div>

      {/* Sprint Planning + AI Insights */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-[#111116]/80 backdrop-blur-sm border border-white/[0.07] rounded-2xl p-5">
          <SprintPlanning tasks={tasks} />
        </div>
        <div className="bg-[#111116]/80 backdrop-blur-sm border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center text-violet-400 text-sm font-bold">✦</div>
            <h2 className="text-sm font-semibold text-white">AI Insights</h2>
          </div>
          <div className="space-y-2">
            {insights.map((ins, i) => <InsightPill key={i} {...ins} />)}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[#111116]/80 backdrop-blur-sm border border-white/[0.07] rounded-2xl p-5">
        <SectionHead title="Recent Activity" right={`${activity.length} updates`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          {activity.length === 0 && <p className="text-zinc-600 text-sm col-span-3">No recent activity yet.</p>}
          {activity.map((a, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                a.status === "done" ? "bg-emerald-400" : a.status === "blocked" ? "bg-red-400" : "bg-emerald-300/60"
              }`} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-zinc-200">{a.name}</span>
                <span className="text-xs text-zinc-600"> {a.action} </span>
                <p className="text-xs text-zinc-400 leading-snug truncate">{a.task}</p>
              </div>
              <span className="text-[10px] text-zinc-700 flex-shrink-0 mt-0.5 whitespace-nowrap">
                {a.time ? new Date(a.time).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
