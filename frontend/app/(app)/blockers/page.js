"use client";
import { useEffect, useState } from "react";
import { api, getSession } from "../../../lib/api";

function ageColor(d) {
  if (d >= 7) return "text-red-400";
  if (d >= 3) return "text-amber-400";
  return "text-slate-400";
}

function Comments({ blockerId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const session = getSession();

  const load = () =>
    api(`/blockers/${blockerId}/comments`).then(setComments).catch(() => {});
  useEffect(() => {
    load();
  }, [blockerId]);

  async function add() {
    if (!text.trim()) return;
    await api(`/blockers/${blockerId}/comments`, {
      method: "POST",
      body: { text },
    });
    setText("");
    load();
  }

  async function del(id) {
    await api(`/blockers/comments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mt-3 border-t border-slate-700 pt-3">
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className="text-sm">
            <span className="text-indigo-300 font-medium">
              {c.author_name}
            </span>{" "}
            <span className="text-slate-500 text-xs">
              {new Date(c.created_at).toLocaleString()}
            </span>
            <div className="text-slate-200">{c.text}</div>
            {(c.author_name === session.name ||
              ["admin", "lead"].includes(session.role)) && (
              <button
                onClick={() => del(c.id)}
                className="text-xs text-slate-500 hover:text-red-400"
              >
                delete
              </button>
            )}
          </div>
        ))}
        {comments.length === 0 && (
          <div className="text-xs text-slate-500">No comments yet.</div>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          className="flex-1 p-2 rounded bg-slate-700 text-sm outline-none"
          placeholder="Add a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          className="bg-indigo-600 hover:bg-indigo-500 px-3 rounded text-sm"
        >
          Post
        </button>
      </div>
    </div>
  );
}

export default function BlockersPage() {
  const [blockers, setBlockers] = useState([]);
  const [open, setOpen] = useState(null);

  const load = () => api("/blockers").then(setBlockers).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function resolve(id) {
    await api(`/blockers/${id}/resolve`, { method: "POST" });
    load();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Active Blockers</h1>
      {blockers.length === 0 && (
        <div className="text-slate-500 text-sm">No active blockers 🎉</div>
      )}
      {blockers.map((b) => (
        <div key={b.id} className="bg-slate-800 p-4 rounded-xl">
          <div className="flex justify-between">
            <div>
              <div className="font-medium">{b.reason}</div>
              <div className="text-sm text-slate-400">
                {b.owner_name} ·{" "}
                <span className={ageColor(b.age_days)}>
                  blocked {b.age_days}d
                </span>
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <button
                onClick={() => setOpen(open === b.id ? null : b.id)}
                className="text-indigo-400 hover:text-indigo-300"
              >
                {b.comment_count} comments
              </button>
              <button
                onClick={() => resolve(b.id)}
                className="text-emerald-400 hover:text-emerald-300"
              >
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
