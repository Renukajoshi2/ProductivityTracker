"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";

const STATUS_META = {
  open:        { label: "Open",        cls: "bg-zinc-700/40    text-zinc-400   ring-zinc-600/30" },
  in_progress: { label: "In Progress", cls: "bg-cyan-900/40    text-cyan-200   ring-cyan-700/30" },
  blocked:     { label: "Blocked",     cls: "bg-red-900/40     text-red-200    ring-red-700/30"  },
  done:        { label: "Done",        cls: "bg-emerald-900/40 text-emerald-200 ring-emerald-700/30" },
};

const CHANGEABLE = ["in_progress", "done", "blocked"];

// ── Inline status dropdown ────────────────────────────────────────────────────
function StatusSelect({ task, onChange }) {
  const [saving, setSaving] = useState(false);
  const meta = STATUS_META[task.status] || STATUS_META.open;

  async function handleChange(e) {
    const next = e.target.value;
    if (next === task.status) return;
    setSaving(true);
    try {
      await api(`/tasks/${task.id}/status`, { method: "PATCH", body: { status: next } });
      onChange(task.id, next);
    } catch {/**/} finally { setSaving(false); }
  }

  return (
    <div className="relative inline-block">
      <select value={task.status} onChange={handleChange} disabled={saving}
        className={`text-xs font-medium px-2 py-0.5 rounded-full appearance-none cursor-pointer pr-5 outline-none ring-1 disabled:opacity-60 ${meta.cls}`}>
        {CHANGEABLE.map(s => (
          <option key={s} value={s} className="bg-[#111116] text-zinc-200">{STATUS_META[s].label}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px]">▾</span>
    </div>
  );
}

// ── Column filter dropdown ────────────────────────────────────────────────────
function ColFilter({ label, options, value, onChange, active }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide group ${active ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300"}`}>
        {label}
        <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""} ${active ? "text-violet-400" : "text-zinc-600 group-hover:text-zinc-400"}`}>▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-[#111116] border border-white/[0.07] rounded-xl shadow-2xl min-w-[160px] py-1 text-sm">
          {options.map(({ val, display }) => (
            <button key={val} onClick={() => { onChange(val); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 hover:bg-white/[0.04] flex items-center gap-2 transition-colors ${value === val ? "text-violet-400 font-medium" : "text-zinc-300"}`}>
              {value === val ? <span className="text-violet-400 text-xs">✓</span> : <span className="w-3" />}
              {display}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ProgressNote({ note, pct }) {
  if (note) return <span className="text-xs text-zinc-300 leading-snug">{note}</span>;
  if (pct === 100) return <span className="text-xs text-emerald-400">Completed</span>;
  if (pct === 0)   return <span className="text-xs text-zinc-600">Not started</span>;
  return <span className="text-xs text-zinc-600">{pct}% — no update logged</span>;
}

function etaDiff(dueDate) {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dueDate) - today) / 86400000);
}

function EtaCell({ dueDate, status }) {
  if (!dueDate || status === "done") return <span className="text-zinc-700">—</span>;
  const diff = etaDiff(dueDate);
  let cls = "text-zinc-300", suffix = `(${diff}d)`;
  if (diff < 0)        { cls = "text-red-400 font-medium";   suffix = `(${Math.abs(diff)}d overdue)`; }
  else if (diff === 0) { cls = "text-amber-400 font-medium"; suffix = "(today)"; }
  else if (diff <= 2)  { cls = "text-amber-300";             suffix = `(${diff}d left)`; }
  return <span className={`text-xs ${cls} whitespace-nowrap`}>{dueDate} {suffix}</span>;
}

async function exportToExcel(tasks) {
  const XLSX = (await import("xlsx")).default;
  const rows = tasks.map(t => ({
    "Task":          t.title,
    "Assigned To":   t.owner_name,
    "Status":        t.status.replace("_", " "),
    "Latest Update": t.progress_note || "",
    "ETA":           t.due_date || "",
    "Blocker":       t.blocker_reason || "",
    "Started":       t.first_seen  ? new Date(t.first_seen).toLocaleDateString()  : "",
    "Completed":     t.completed_at ? new Date(t.completed_at).toLocaleDateString() : "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch:40 },{ wch:18 },{ wch:14 },{ wch:40 },{ wch:22 },{ wch:50 },{ wch:14 },{ wch:14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");
  XLSX.writeFile(wb, `tasks_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks,    setTasks]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [exporting,setExporting]= useState(false);
  const [search,   setSearch]   = useState("");
  const [filterMember, setFilterMember] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEta,    setFilterEta]    = useState("all");

  useEffect(() => {
    api("/tasks").then(setTasks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function onStatusChange(taskId, newStatus) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  }

  const memberOptions = useMemo(() => {
    const names = [...new Set(tasks.map(t => t.owner_name))].sort();
    return [{ val: "all", display: "All Members" }, ...names.map(n => ({ val: n, display: n }))];
  }, [tasks]);

  const statusOptions = [
    { val: "all",         display: "All Statuses" },
    { val: "in_progress", display: "In Progress" },
    { val: "blocked",     display: "Blocked" },
    { val: "done",        display: "Done" },
  ];

  const etaOptions = [
    { val: "all",     display: "All" },
    { val: "overdue", display: "Overdue" },
    { val: "today",   display: "Due Today" },
    { val: "week",    display: "Due This Week" },
    { val: "none",    display: "No ETA" },
  ];

  const visible = useMemo(() => tasks.filter(t => {
    if (filterMember !== "all" && t.owner_name !== filterMember) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterEta !== "all") {
      const diff = etaDiff(t.due_date);
      if (filterEta === "none"    && t.due_date)                             return false;
      if (filterEta === "overdue" && (diff === null || diff >= 0))           return false;
      if (filterEta === "today"   && diff !== 0)                             return false;
      if (filterEta === "week"    && (diff === null || diff < 0 || diff > 7))return false;
    }
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
                  !t.owner_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, filterMember, filterStatus, filterEta, search]);

  const grouped = useMemo(() => {
    const order = [...new Set(tasks.map(t => t.owner_name))];
    const map = {};
    visible.forEach(t => { if (!map[t.owner_name]) map[t.owner_name] = []; map[t.owner_name].push(t); });
    return order.filter(n => map[n]).map(n => ({ member: n, ownerId: map[n][0].owner_id, tasks: map[n] }));
  }, [visible, tasks]);

  async function handleExport() {
    setExporting(true);
    try { await exportToExcel(visible); } finally { setExporting(false); }
  }

  return (
    <div className="w-full px-2 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-white">Tasks</h1>
        <div className="flex gap-2 items-center">
          <input
            className="bg-[#16161f] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/10 transition-all w-52"
            placeholder="Search task or member…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={handleExport} disabled={exporting || visible.length === 0}
            className="flex items-center gap-1.5 bg-[#111116] hover:bg-[#16161f] border border-white/[0.07] hover:border-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 hover:text-violet-300 text-sm px-3 py-2 rounded-xl transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? "Exporting…" : "Export Excel"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-[#111116] rounded-xl" />)}
        </div>
      )}
      {!loading && visible.length === 0 && (
        <div className="text-zinc-600 text-sm py-8 text-center">No tasks match your filters.</div>
      )}

      {!loading && visible.length > 0 && (
        <div className="bg-[#111116] border border-white/[0.07] rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] select-none">
                <th className="text-left px-4 py-3 text-zinc-600 text-xs w-10">#</th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 uppercase tracking-wide">Task</th>
                <th className="text-left px-4 py-3">
                  <ColFilter label="Assigned To" options={memberOptions} value={filterMember} onChange={setFilterMember} active={filterMember !== "all"} />
                </th>
                <th className="text-left px-4 py-3">
                  <ColFilter label="Status" options={statusOptions} value={filterStatus} onChange={setFilterStatus} active={filterStatus !== "all"} />
                </th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 uppercase tracking-wide">Latest Update</th>
                <th className="text-left px-4 py-3">
                  <ColFilter label="ETA" options={etaOptions} value={filterEta} onChange={setFilterEta} active={filterEta !== "all"} />
                </th>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 uppercase tracking-wide">Blocker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {(() => {
                let n = 0;
                return grouped.flatMap(({ tasks: memberTasks }) =>
                  memberTasks.map(t => (
                    <tr key={t.id} className="hover:bg-white/[0.025] transition-colors">
                      <td className="px-4 py-3 text-zinc-700 text-xs">{++n}</td>
                      <td className="px-4 py-3 font-medium text-zinc-200 leading-snug">{t.title}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link href={`/tasks/${t.owner_id}`} className="text-violet-400 hover:text-violet-300 hover:underline transition-colors">
                          {t.owner_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><StatusSelect task={t} onChange={onStatusChange} /></td>
                      <td className="px-4 py-3 max-w-sm"><ProgressNote note={t.progress_note} pct={t.progress_pct} /></td>
                      <td className="px-4 py-3"><EtaCell dueDate={t.due_date} status={t.status} /></td>
                      <td className="px-4 py-3 text-xs text-red-400 max-w-xs">
                        {t.blocker_reason || <span className="text-zinc-700">—</span>}
                      </td>
                    </tr>
                  ))
                );
              })()}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-zinc-700">
        Showing {visible.length} of {tasks.length} tasks across {grouped.length} member{grouped.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
