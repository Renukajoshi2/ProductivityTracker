"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "member",
  });
  const [err, setErr] = useState("");

  const load = () => api("/users").then(setUsers).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    setErr("");
    try {
      await api("/users", { method: "POST", body: form });
      setForm({ name: "", email: "", password: "", role: "member" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function toggle(u) {
    await api(`/users/${u.id}/active?active=${!u.active}`, { method: "PUT" });
    load();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Team</h1>

      <form
        onSubmit={create}
        className="bg-slate-800 p-4 rounded-xl flex gap-2 flex-wrap items-end"
      >
        {["name", "email", "password"].map((f) => (
          <input
            key={f}
            className="p-2 rounded bg-slate-700 outline-none"
            placeholder={f}
            type={f === "password" ? "password" : "text"}
            value={form[f]}
            onChange={(e) => setForm({ ...form, [f]: e.target.value })}
            required
          />
        ))}
        <select
          className="p-2 rounded bg-slate-700"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="member">member</option>
          <option value="lead">lead</option>
          <option value="admin">admin</option>
        </select>
        <button className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded">
          Add member
        </button>
        {err && <span className="text-red-400 text-sm">{err}</span>}
      </form>

      <table className="w-full bg-slate-800 rounded-xl overflow-hidden text-sm">
        <thead className="bg-slate-700 text-left">
          <tr>
            <th className="p-3">Name</th>
            <th className="p-3">Email</th>
            <th className="p-3">Role</th>
            <th className="p-3">Status</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-slate-700">
              <td className="p-3">{u.name}</td>
              <td className="p-3">{u.email}</td>
              <td className="p-3">{u.role}</td>
              <td className="p-3">
                {u.active ? (
                  <span className="text-emerald-400">active</span>
                ) : (
                  <span className="text-red-400">disabled</span>
                )}
              </td>
              <td className="p-3">
                <button
                  onClick={() => toggle(u)}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  {u.active ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
