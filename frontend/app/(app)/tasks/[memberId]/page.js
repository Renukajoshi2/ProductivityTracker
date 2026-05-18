"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "../../../../lib/api";

const STATUS_STYLES = {
  open:        { label: "Open",        cls: "bg-zinc-700/40    text-zinc-400   border-zinc-600/30" },
  in_progress: { label: "In Progress", cls: "bg-cyan-900/40    text-cyan-200   border-cyan-700/30" },
  blocked:     { label: "Blocked",     cls: "bg-red-900/40     text-red-200    border-red-700/30"  },
  done:        { label: "Done",        cls: "bg-emerald-900/40 text-emerald-200 border-emerald-700/30" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.open;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
  );
}

function ProgressNote({ note, pct }) {
  if (note) return <span className="text-xs text-zinc-300 leading-snug">{note}</span>;
  if (pct === 100) return <span className="text-xs text-emerald-400">Completed</span>;
  if (pct === 0)   return <span className="text-xs text-zinc-600">Not started</span>;
  return <span className="text-xs text-zinc-600">{pct}% — no update logged</span>;
}

function TaskRow({ t }) {
  return (
    <tr className="border-b border-white/[0.05] hover:bg-white/[0.025] transition-colors">
      <td className="px-4 py-3 font-medium text-zinc-200 leading-snug">{t.title}</td>
      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
      <td className="px-4 py-3 max-w-xs"><ProgressNote note={t.progress_note} pct={t.progress_pct} /></td>
      <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
        {t.first_seen ? new Date(t.first_seen).toLocaleDateString() : "—"}
      </td>
      <td className="px-4 py-3 text-xs text-red-400 max-w-xs">
        {t.blocker_reason || <span className="text-zinc-700">—</span>}
      </td>
    </tr>
  );
}

export default function MemberPage() {
  const { memberId } = useParams();
  const [data,    setData]    = useState(null);
  const [tab,     setTab]     = useState("active");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!memberId) return;
    api(`/tasks/member/${memberId}`)
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [memberId]);

  if (loading) return <div className="text-zinc-600 text-sm p-6">Loading…</div>;
  if (error)   return <div className="text-red-400 text-sm p-6">{error}</div>;
  if (!data)   return null;

  const activeTasks = data.tasks.filter(t => t.status !== "done");
  const doneTasks   = data.tasks.filter(t => t.status === "done");
  const counts = {
    in_progress: activeTasks.filter(t => t.status === "in_progress").length,
    blocked:     activeTasks.filter(t => t.status === "blocked").length,
    open:        activeTasks.filter(t => t.status === "open").length,
    done:        doneTasks.length,
  };

  const tabs = [
    { key: "active",  label: `Active (${activeTasks.length})` },
    { key: "history", label: `History (${doneTasks.length})` },
    { key: "eod",     label: `EOD Reports (${data.eod_reports.length})` },
  ];

  const tableHead = (cols) => (
    <thead>
      <tr className="text-xs uppercase text-zinc-600 tracking-wide border-b border-white/[0.07]">
        {cols.map(c => <th key={c} className="text-left px-4 py-3">{c}</th>)}
      </tr>
    </thead>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/tasks" className="text-sm text-zinc-500 hover:text-white transition-colors flex items-center gap-1">
        ← Back to Tasks
      </Link>

      {/* Member header */}
      <div className="bg-[#111116] border border-white/[0.07] rounded-2xl p-5 flex items-center gap-5 flex-wrap">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-2xl font-bold text-white shadow-md shadow-violet-900/40 flex-shrink-0">
          {data.user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-white">{data.user.name}</h1>
          <div className="text-sm text-zinc-500 capitalize mt-0.5">{data.user.role} · {data.user.email}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs bg-cyan-900/30 text-cyan-300 border border-cyan-700/30 px-3 py-1 rounded-full">
            {counts.in_progress} in progress
          </span>
          <span className="text-xs bg-red-900/30 text-red-300 border border-red-700/30 px-3 py-1 rounded-full">
            {counts.blocked} blocked
          </span>
          <span className="text-xs bg-emerald-900/30 text-emerald-300 border border-emerald-700/30 px-3 py-1 rounded-full">
            {counts.done} done
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.07]">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-violet-500 text-violet-300"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Active Tasks */}
      {tab === "active" && (
        <div className="bg-[#111116] border border-white/[0.07] rounded-2xl overflow-hidden">
          {activeTasks.length === 0
            ? <div className="p-8 text-center text-zinc-600 text-sm">No active tasks.</div>
            : <table className="w-full text-sm">
                {tableHead(["Task", "Status", "Latest Update", "Since", "Blocker"])}
                <tbody>{activeTasks.map(t => <TaskRow key={t.id} t={t} />)}</tbody>
              </table>
          }
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div className="bg-[#111116] border border-white/[0.07] rounded-2xl overflow-hidden">
          {doneTasks.length === 0
            ? <div className="p-8 text-center text-zinc-600 text-sm">No completed tasks yet.</div>
            : <table className="w-full text-sm">
                {tableHead(["Task", "Status", "Latest Update", "Started", "Blocker"])}
                <tbody>{doneTasks.map(t => <TaskRow key={t.id} t={t} />)}</tbody>
              </table>
          }
        </div>
      )}

      {/* EOD Reports */}
      {tab === "eod" && (
        <div className="space-y-3">
          {data.eod_reports.length === 0
            ? <div className="text-zinc-600 text-sm">No EOD reports yet.</div>
            : data.eod_reports.map(r => (
                <div key={r.date} className="bg-[#111116] border border-white/[0.07] rounded-2xl p-4">
                  <div className="text-xs text-zinc-500 font-medium mb-1.5">{r.date}</div>
                  <div className="text-sm text-zinc-300 leading-relaxed">{r.summary}</div>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}
