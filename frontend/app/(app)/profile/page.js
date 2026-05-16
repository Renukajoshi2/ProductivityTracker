"use client";
import { useState } from "react";
import { api, getSession } from "../../../lib/api";

export default function ProfilePage() {
  const s = getSession();
  const [oldp, setOld] = useState("");
  const [newp, setNew] = useState("");
  const [msg, setMsg] = useState("");

  async function change(e) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/auth/password", {
        method: "POST",
        body: { old_password: oldp, new_password: newp },
      });
      setMsg("Password updated.");
      setOld("");
      setNew("");
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Profile</h1>
      <div className="bg-slate-800 p-4 rounded-xl text-sm space-y-1">
        <div>
          <span className="text-slate-400">Name:</span> {s.name}
        </div>
        <div>
          <span className="text-slate-400">Role:</span> {s.role}
        </div>
      </div>
      <form onSubmit={change} className="bg-slate-800 p-4 rounded-xl space-y-3">
        <h2 className="font-medium">Change password</h2>
        <input
          className="w-full p-2 rounded bg-slate-700 outline-none"
          type="password"
          placeholder="Current password"
          value={oldp}
          onChange={(e) => setOld(e.target.value)}
          required
        />
        <input
          className="w-full p-2 rounded bg-slate-700 outline-none"
          type="password"
          placeholder="New password (min 6 chars)"
          value={newp}
          onChange={(e) => setNew(e.target.value)}
          required
        />
        <button className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded w-full">
          Update
        </button>
        {msg && <p className="text-sm text-slate-300">{msg}</p>}
      </form>
    </div>
  );
}
