"use client";
import { useEffect, useRef, useState } from "react";
import { api, getSession } from "../../lib/api";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [eodPending, setEodPending] = useState(false);
  const endRef = useRef(null);
  const isLead =
    typeof window !== "undefined" &&
    ["admin", "lead"].includes(getSession().role);

  useEffect(() => {
    api("/chat/history")
      .then((d) => {
        setMessages(d.messages);
        setEodPending(d.eod_pending);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text) {
    const msg = text ?? input;
    if (!msg.trim() || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const d = await api("/chat", { method: "POST", body: { message: msg } });
      setMessages((m) => [...m, { role: "assistant", content: d.reply }]);
      setEodPending(false);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "⚠️ " + e.message },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-7rem)]">
      {eodPending && (
        <div className="bg-amber-900/40 text-amber-200 p-3 rounded mb-3 text-sm">
          ⏰ Your end-of-day update is pending. Say "hi" to start.
        </div>
      )}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.length === 0 && (
          <div className="text-slate-500 text-sm text-center mt-10">
            {isLead
              ? 'Ask things like "Give me today\'s team summary" or "What\'s the status of the payments task?"'
              : 'Tell me about your day. Try: "Starting my EOD update."'}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "text-right" : "text-left"}
          >
            <span
              className={
                "inline-block px-3 py-2 rounded-lg max-w-[80%] whitespace-pre-wrap " +
                (m.role === "user"
                  ? "bg-indigo-600"
                  : "bg-slate-700 text-slate-100")
              }
            >
              {m.content}
            </span>
          </div>
        ))}
        {busy && <div className="text-slate-500 text-sm">typing…</div>}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 mt-3">
        <input
          className="flex-1 p-3 rounded bg-slate-700 outline-none"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={() => send()}
          disabled={busy}
          className="bg-indigo-600 hover:bg-indigo-500 px-5 rounded font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
