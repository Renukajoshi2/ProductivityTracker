"use client";
import { useState } from "react";
import { api, getSession } from "../../../lib/api";

export default function ProfilePage() {
  const s = getSession();
  const [oldp, setOld] = useState("");
  const [newp, setNew] = useState("");
  const [msg,  setMsg] = useState("");
  const [ok,   setOk]  = useState(false);

  async function change(e) {
    e.preventDefault();
    setMsg(""); setOk(false);
    try {
      await api("/auth/password", { method: "POST", body: { old_password: oldp, new_password: newp } });
      setMsg("Password updated successfully.");
      setOk(true);
      setOld(""); setNew("");
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-xl font-semibold text-white">Profile</h1>

      {/* Info card */}
      <div className="bg-[#111116] border border-white/[0.07] rounded-2xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-2xl font-bold text-white shadow-md shadow-violet-900/40 flex-shrink-0">
          {s.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div className="text-base font-semibold text-white">{s.name}</div>
          <div className="text-sm text-zinc-500 capitalize mt-0.5">{s.role}</div>
        </div>
      </div>

      {/* Change password */}
      <form onSubmit={change} className="bg-[#111116] border border-white/[0.07] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Change Password</h2>
        <input
          className="w-full px-3 py-2.5 rounded-xl bg-[#16161f] border border-white/[0.07] text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/10 transition-all"
          type="password" placeholder="Current password"
          value={oldp} onChange={e => setOld(e.target.value)} required
        />
        <input
          className="w-full px-3 py-2.5 rounded-xl bg-[#16161f] border border-white/[0.07] text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/10 transition-all"
          type="password" placeholder="New password (min 6 chars)"
          value={newp} onChange={e => setNew(e.target.value)} required
        />
        <button className="w-full py-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600 text-white text-sm font-semibold transition-all active:scale-[0.98] shadow-md shadow-violet-900/30">
          Update Password
        </button>
        {msg && (
          <p className={`text-sm text-center ${ok ? "text-emerald-400" : "text-red-400"}`}>{msg}</p>
        )}
      </form>
    </div>
  );
}
