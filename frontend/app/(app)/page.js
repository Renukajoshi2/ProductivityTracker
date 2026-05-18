"use client";
import { useEffect, useRef, useState } from "react";
import { api, getSession } from "../../lib/api";

const LEAD_SUGGESTIONS = [
  { text: "Give me today's team summary", accent: "violet" },
  { text: "Show all blocked tasks",       accent: "rose"   },
  { text: "Who made progress today?",     accent: "cyan"   },
  { text: "Which tasks are overdue?",     accent: "amber"  },
  { text: "Summarise this week's work",   accent: "fuchsia"},
];

const MEMBER_SUGGESTIONS = [
  { text: "I want to update my tasks",  accent: "violet"  },
  { text: "I finished a task today",    accent: "emerald" },
  { text: "I have a blocker to report", accent: "rose"    },
  { text: "What are my open tasks?",    accent: "cyan"    },
];

const CHIP_STYLE = {
  violet:  "border-violet-500/30  text-violet-300  hover:bg-violet-500/10  hover:border-violet-400/60",
  rose:    "border-rose-500/30    text-rose-300    hover:bg-rose-500/10    hover:border-rose-400/60",
  cyan:    "border-cyan-500/30    text-cyan-300    hover:bg-cyan-500/10    hover:border-cyan-400/60",
  amber:   "border-amber-500/30   text-amber-300   hover:bg-amber-500/10   hover:border-amber-400/60",
  fuchsia: "border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/10 hover:border-fuchsia-400/60",
  emerald: "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-400/60",
};

const CARD_STYLE = {
  violet:  "bg-violet-500/8  border-violet-500/20  hover:bg-violet-500/14  hover:border-violet-400/50  text-violet-200",
  rose:    "bg-rose-500/8    border-rose-500/20    hover:bg-rose-500/14    hover:border-rose-400/50    text-rose-200",
  cyan:    "bg-cyan-500/8    border-cyan-500/20    hover:bg-cyan-500/14    hover:border-cyan-400/50    text-cyan-200",
  amber:   "bg-amber-500/8   border-amber-500/20   hover:bg-amber-500/14   hover:border-amber-400/50   text-amber-200",
  fuchsia: "bg-fuchsia-500/8 border-fuchsia-500/20 hover:bg-fuchsia-500/14 hover:border-fuchsia-400/50 text-fuchsia-200",
  emerald: "bg-emerald-500/8 border-emerald-500/20 hover:bg-emerald-500/14 hover:border-emerald-400/50 text-emerald-200",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <div className="flex items-end gap-2.5">
      <BotAvatar />
      <div className="bg-[#16161f] border border-white/[0.07] rounded-2xl rounded-bl-sm px-4 py-3.5 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce"
            style={{ animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }} />
        ))}
      </div>
    </div>
  );
}

// ── Avatars ───────────────────────────────────────────────────────────────────
function BotAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-[13px] text-white flex-shrink-0 shadow-md shadow-violet-900/40">
      ✦
    </div>
  );
}
function UserAvatar({ name }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-200 flex-shrink-0">
      {name?.[0]?.toUpperCase() ?? "U"}
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button onClick={copy}
      className="p-1 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-all"
      title="Copy">
      {copied
        ? <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-emerald-400"><path d="M13.5 2.5l-8 8-3-3-1.5 1.5 4.5 4.5 9.5-9.5z"/></svg>
        : <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M4 2a2 2 0 00-2 2v8a2 2 0 002 2h5a2 2 0 002-2V9l-4-4H4zm4 0l4 4h-3a1 1 0 01-1-1V2z"/><path d="M9 9H4V4h4v4a1 1 0 001 1h4v5a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2h5l4 4v5a2 2 0 01-2 2z" fillRule="evenodd" clipRule="evenodd"/></svg>
      }
    </button>
  );
}

// ── Thumb buttons ─────────────────────────────────────────────────────────────
function ThumbBtn({ up }) {
  const [active, setActive] = useState(false);
  return (
    <button onClick={() => setActive(v => !v)}
      className={`p-1 rounded-lg transition-all ${active ? (up ? "text-emerald-400" : "text-rose-400") : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"}`}
      title={up ? "Good response" : "Poor response"}>
      {up
        ? <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M1 9l2 1v4h1V9H3l-2-1zm3-7a1 1 0 00-1 1v1H2a1 1 0 00-1 1v1l2 1h1V3h1l1-1H4zm5 0H7l-1 1v5l1 1h1v2l1 1h1a1 1 0 001-1V8l1-1V3a1 1 0 00-1-1z"/></svg>
        : <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M15 7l-2-1V2H12V7h1l2 1zm-3 7a1 1 0 001-1v-1h1a1 1 0 001-1v-1l-2-1h-1v3h-1l-1 1h2zm-5 0h2l1-1V8h-1V6l-1-1H7a1 1 0 00-1 1v5l-1 1v1a1 1 0 001 1z"/></svg>
      }
    </button>
  );
}

// ── Main chat ─────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [eodPending, setEodPending] = useState(false);
  const endRef   = useRef(null);
  const inputRef = useRef(null);
  const session  = typeof window !== "undefined" ? getSession() : {};
  const isLead   = ["admin", "lead"].includes(session.role);
  const suggestions = isLead ? LEAD_SUGGESTIONS : MEMBER_SUGGESTIONS;

  useEffect(() => {
    api("/chat/history").then(d => {
      setMessages(d.messages);
      setEodPending(d.eod_pending);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text) {
    const msg = text ?? input;
    if (!msg.trim() || busy) return;
    setInput("");
    inputRef.current?.focus();
    setMessages(m => [...m, { role: "user", content: msg, ts: Date.now() }]);
    setBusy(true);
    try {
      const d = await api("/chat", { method: "POST", body: { message: msg } });
      setMessages(m => [...m, { role: "assistant", content: d.reply, ts: Date.now() }]);
      setEodPending(false);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: "⚠️ " + e.message, ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] max-w-3xl mx-auto">

      {/* ── Chat Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3.5 mb-3 bg-[#111116] border border-white/[0.06] rounded-2xl flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-sm text-white shadow-md shadow-violet-900/40 flex-shrink-0">
          ✦
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white leading-none">AI Assistant</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-zinc-500">Online · {isLead ? "Lead mode" : "Member mode"}</span>
          </div>
        </div>
        {/* Clear / new chat hint */}
        <div className="text-[11px] text-zinc-600 hidden sm:block">
          {isLead ? "Ask about your team" : "Log your daily progress"}
        </div>
      </div>

      {/* ── EOD Banner ────────────────────────────────────────────────────── */}
      {eodPending && (
        <div className="flex items-center gap-2.5 bg-amber-500/[0.08] border border-amber-500/25 text-amber-200 px-4 py-2.5 rounded-xl mb-3 text-sm flex-shrink-0">
          <span>⏰</span>
          <span>Your end-of-day update is pending — say <span className="font-semibold text-amber-100">"hi"</span> to start.</span>
        </div>
      )}

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-7 pb-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-600/25 to-indigo-600/15 border border-violet-500/20 flex items-center justify-center text-3xl mb-4 shadow-xl shadow-violet-900/20">
                ✦
              </div>
              <h2 className="text-xl font-semibold text-white">
                {isLead ? "What would you like to know?" : `Hey ${session.name?.split(" ")[0] ?? "there"} 👋`}
              </h2>
              <p className="text-sm text-zinc-500">
                {isLead ? "Ask about team status, blockers, or daily progress." : "Log tasks, report blockers, or submit your EOD update."}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              {suggestions.map(s => (
                <button key={s.text} onClick={() => send(s.text)} disabled={busy}
                  className={`text-left border rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 disabled:opacity-40 ${CARD_STYLE[s.accent]}`}>
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((m, i) =>
          m.role === "user" ? (

            /* ── User bubble ───────────────────────────────────────────── */
            <div key={i} className="flex flex-col items-end gap-1.5">
              <div className="flex items-end gap-2.5">
                <div className="max-w-[76%] bg-gradient-to-br from-violet-600 to-indigo-700 text-white px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed whitespace-pre-wrap shadow-lg shadow-violet-900/25">
                  {m.content}
                </div>
                <UserAvatar name={session.name} />
              </div>
              {m.ts && (
                <div className="flex items-center gap-1 mr-11 text-[10px] text-zinc-600">
                  <span>{fmtTime(m.ts)}</span>
                  {/* Double tick delivered */}
                  <svg viewBox="0 0 16 10" fill="currentColor" className="w-3.5 h-2.5 text-violet-400/70">
                    <path d="M1 5l3.5 4L12 1M5 5l3.5 4L16 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>

          ) : (

            /* ── Bot bubble ────────────────────────────────────────────── */
            <div key={i} className="flex flex-col items-start gap-1.5">
              <div className="flex items-end gap-2.5">
                <BotAvatar />
                <div className="max-w-[76%] bg-[#16161f] border border-white/[0.07] px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed text-zinc-100 whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
              <div className="flex items-center gap-0.5 ml-11">
                {m.ts && <span className="text-[10px] text-zinc-600 mr-1.5">{fmtTime(m.ts)}</span>}
                <CopyBtn text={m.content} />
                <ThumbBtn up={true} />
                <ThumbBtn up={false} />
              </div>
            </div>
          )
        )}

        {/* Typing indicator */}
        {busy && <TypingBubble />}
        <div ref={endRef} />
      </div>

      {/* ── Quick chips ───────────────────────────────────────────────────── */}
      {messages.length > 0 && (
        <div className="flex gap-1.5 flex-wrap py-2 flex-shrink-0">
          {suggestions.map(s => (
            <button key={s.text} onClick={() => send(s.text)} disabled={busy}
              className={`text-[11px] border rounded-full px-3 py-1 transition-all duration-200 disabled:opacity-40 ${CHIP_STYLE[s.accent]}`}>
              {s.text}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-[#111116] border border-white/[0.07] rounded-2xl px-4 py-3 flex-shrink-0 mt-1 focus-within:border-violet-500/40 focus-within:ring-1 focus-within:ring-violet-500/10 transition-all">
        {/* Mic icon */}
        <button className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0" title="Voice (coming soon)">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5 w-[18px] h-[18px]">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
        </button>

        <input
          ref={inputRef}
          className="flex-1 bg-transparent outline-none text-sm text-zinc-100 placeholder-zinc-600 min-w-0"
          placeholder="Ask anything…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
        />

        {/* Send button — circular */}
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white flex-shrink-0 hover:from-violet-500 hover:to-indigo-600 disabled:opacity-35 disabled:cursor-not-allowed transition-all active:scale-90 shadow-md shadow-violet-900/40"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M8 2l6 6H9v6H7V8H2z" transform="rotate(-90 8 8)" />
          </svg>
        </button>
      </div>

    </div>
  );
}
