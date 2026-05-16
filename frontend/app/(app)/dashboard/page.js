"use client";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { api } from "../../../lib/api";

function Card({ label, value }) {
  return (
    <div className="bg-slate-800 p-4 rounded-xl">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [team, setTeam] = useState([]);

  useEffect(() => {
    api("/stats/summary").then(setSummary).catch(() => {});
    api("/stats/daily?days=14").then(setDaily).catch(() => {});
    api("/stats/team").then(setTeam).catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card label="Completed today" value={summary?.completed_today ?? "—"} />
        <Card label="Open tasks" value={summary?.open_tasks ?? "—"} />
        <Card label="Active blockers" value={summary?.active_blockers ?? "—"} />
        <Card
          label="Completion rate"
          value={summary ? summary.completion_rate + "%" : "—"}
        />
      </div>

      <div className="bg-slate-800 p-4 rounded-xl">
        <h2 className="mb-3 font-medium">Tasks completed (last 14 days)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={daily}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="completed" stroke="#818cf8" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800 p-4 rounded-xl">
        <h2 className="mb-3 font-medium">Productivity by member</h2>
        <ResponsiveContainer width="100%" height={Math.max(240, team.length * 40)}>
          <BarChart data={team} layout="vertical">
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} />
            <Tooltip />
            <Bar dataKey="done" fill="#34d399" name="Done" />
            <Bar dataKey="open" fill="#60a5fa" name="Open" />
            <Bar dataKey="blocked" fill="#f87171" name="Blocked" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
