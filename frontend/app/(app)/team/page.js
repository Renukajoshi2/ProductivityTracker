"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

const ROLE_BADGE = {
  admin:  "bg-violet-500/15 text-violet-300 border-violet-500/25",
  lead:   "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  member: "bg-zinc-700/40   text-zinc-400   border-zinc-600/30",
};

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [form,  setForm]  = useState({ name: "", email: "", password: "", role: "member" });
  const [err,   setErr]   = useState("");
  const [busy,  setBusy]  = useState(false);

  const load = () => api("/users").then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await api("/users", { method: "POST", body: form });
      setForm({ name: "", email: "", password: "", role: "member" });
      load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function toggleActive(u) {
    await api(`/users/${u.id}/active?active=${!u.active}`, { method: "PUT" });
    load();
  }

  async function toggleOoo(u) {
    await api(`/users/${u.id}/ooo?ooo=${!u.ooo}`, { method: "PUT" });
    load();
  }

  const inputCls = "px-3 py-2 rounded-xl bg-[#16161f] border border-white/[0.07] text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/10 transition-all";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-white">Team</h1>

      {/* Add member form */}
      <form onSubmit={create} className="bg-[#111116] border border-white/[0.07] rounded-2xl p-5 flex gap-3 flex-wrap items-end">
        <div className="flex gap-3 flex-wrap flex-1">
          {["name", "email", "password"].map(f => (
            <input key={f} className={inputCls}
              placeholder={f.charAt(0).toUpperCase() + f.slice(1)}
              type={f === "password" ? "password" : "text"}
              value={form[f]}
              onChange={e => setForm({ ...form, [f]: e.target.value })}
              required
            />
          ))}
          <select
            className={inputCls + " cursor-pointer"}
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
          >
            <option value="member">Member</option>
            <option value="lead">Lead</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button disabled={busy}
          className="px-5 py-2 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-md shadow-violet-900/30 whitespace-nowrap">
          {busy ? "Adding…" : "Add Member"}
        </button>
        {err && <span className="text-red-400 text-sm w-full">{err}</span>}
      </form>

      {/* Team table */}
      <div className="bg-[#111116] border border-white/[0.07] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0c0c0f] border-b border-white/[0.07]">
            <tr className="text-xs uppercase text-zinc-600 tracking-wide">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">OOO</th>
              <th className="text-left px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-600 text-sm">No team members yet.</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} className="hover:bg-white/[0.025] transition-colors">
                <td className="px-4 py-3 font-medium text-zinc-200">{u.name}</td>
                <td className="px-4 py-3 text-zinc-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_BADGE[u.role] || ROLE_BADGE.member}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.active
                    ? <span className="flex items-center gap-1.5 text-emerald-400 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Active</span>
                    : <span className="flex items-center gap-1.5 text-zinc-600  text-xs"><span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />Disabled</span>}
                </td>
                <td className="px-4 py-3">
                  {u.ooo
                    ? <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-700/30 px-2 py-0.5 rounded-full">Out of Office</span>
                    : <span className="text-zinc-700 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => toggleActive(u)}
                      className={`text-xs font-medium transition-colors ${u.active ? "text-zinc-500 hover:text-red-400" : "text-violet-400 hover:text-violet-300"}`}>
                      {u.active ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => toggleOoo(u)}
                      className={`text-xs font-medium transition-colors ${u.ooo ? "text-emerald-400 hover:text-emerald-300" : "text-amber-400 hover:text-amber-300"}`}>
                      {u.ooo ? "Back in Office" : "Set OOO"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
