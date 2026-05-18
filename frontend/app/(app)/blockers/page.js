"use client";
import { useEffect, useState } from "react";
import { api, getSession } from "../../../lib/api";

function ageColor(d) {
  if (d >= 7) return "text-red-400";
  if (d >= 3) return "text-amber-400";
  return "text-zinc-500";
}

function Comments({ blockerId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const session = getSession();

  const load = () => api(`/blockers/${blockerId}/comments`).then(setComments).catch(() => {});
  useEffect(() => { load(); }, [blockerId]);

  async function add() {
    if (!text.trim()) return;
    await api(`/blockers/${blockerId}/comments`, { method: "POST", body: { text } });
    setText(""); load();
  }

  async function del(id) {
    await api(`/blockers/comments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06]">
      <div className="space-y-2.5 max-h-48 overflow-y-auto mb-3">
        {comments.length === 0 && (
          <p className="text-xs text-zinc-600 italic">No comments yet.</p>
        )}
        {comments.map(c => (
          <div key={c.id} className="text-sm bg-[#0c0c0f]/60 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-violet-300 font-medium text-xs">{c.author_name}</span>
              <span className="text-zinc-700 text-[10px]">{new Date(c.created_at).toLocaleString()}</span>
              {(c.author_name === session.name || ["admin", "lead"].includes(session.role)) && (
                <button onClick={() => del(c.id)} className="ml-auto text-[10px] text-zinc-700 hover:text-red-400 transition-colors">delete</button>
              )}
            </div>
            <div className="text-zinc-300 text-xs leading-relaxed">{c.text}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded-xl bg-[#16161f] border border-white/[0.07] text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/10 transition-all"
          placeholder="Add a comment…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
        />
        <button onClick={add}
          className="px-4 py-2 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600 text-white text-sm font-medium transition-all shadow-sm shadow-violet-900/30">
          Post
        </button>
      </div>
    </div>
  );
}

export default function BlockersPage() {
  const [blockers, setBlockers] = useState([]);
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => api("/blockers").then(setBlockers).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  async function resolve(id) {
    await api(`/blockers/${id}/resolve`, { method: "POST" });
    load();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Active Blockers</h1>
        {!loading && (
          <span className="text-xs text-zinc-600">{blockers.length} blocker{blockers.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {loading && (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-[#111116] rounded-2xl" />)}
        </div>
      )}

      {!loading && blockers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl mb-4">✓</div>
          <p className="text-zinc-400 font-medium">All clear!</p>
          <p className="text-zinc-600 text-sm mt-1">No active blockers right now.</p>
        </div>
      )}

      {!loading && blockers.map(b => (
        <div key={b.id} className="bg-[#111116] border border-white/[0.07] rounded-2xl p-5 hover:border-white/[0.12] transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Red left accent */}
              <div className="flex items-start gap-3">
                <div>
                  <div className="font-medium text-zinc-100 leading-snug">{b.reason}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-zinc-500 font-medium">{b.owner_name}</span>
                    <span className="text-zinc-700">·</span>
                    <span className={`text-xs font-medium ${ageColor(b.age_days)}`}>
                      {b.age_days === 0 ? "today" : `${b.age_days}d blocked`}
                    </span>
                    {b.age_days >= 3 && (
                      <span className="text-[10px] bg-red-500/10 text-red-300 border border-red-700/30 px-2 py-0.5 rounded-full">
                        {b.age_days >= 7 ? "Critical" : "Aging"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => setOpen(open === b.id ? null : b.id)}
                className="text-xs text-zinc-500 hover:text-violet-300 transition-colors flex items-center gap-1">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6l-4 4V5z" clipRule="evenodd"/>
                </svg>
                {b.comment_count}
              </button>
              <button
                onClick={() => resolve(b.id)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-700/30 hover:bg-emerald-500/20 hover:text-emerald-300 transition-all">
                Resolve
              </button>
            </div>
          </div>

          {open === b.id && <Comments blockerId={b.id} />}
        </div>
      ))}
    </div>
  );
}
