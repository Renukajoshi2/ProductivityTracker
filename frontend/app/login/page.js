"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data = await api("/auth/login", {
        method: "POST",
        form: { username: email, password },
      });
      localStorage.setItem("pt_token", data.access_token);
      localStorage.setItem("pt_role", data.role);
      localStorage.setItem("pt_name", data.name);
      router.push("/");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={submit}
        className="bg-slate-800 p-8 rounded-xl w-96 space-y-4"
      >
        <h1 className="text-2xl font-semibold">Productivity Tracker</h1>
        <p className="text-sm text-slate-400">Sign in to continue</p>
        {err && (
          <div className="bg-red-900/50 text-red-200 text-sm p-2 rounded">
            {err}
          </div>
        )}
        <input
          className="w-full p-2 rounded bg-slate-700 outline-none"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full p-2 rounded bg-slate-700 outline-none"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 p-2 rounded font-medium disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-xs text-slate-500">
          No account? Ask your admin to create one.
        </p>
      </form>
    </div>
  );
}
