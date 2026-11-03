"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { id: string; role: string; text: string; at: string; intent: string };

const newSid = () => {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
};

/**
 * WhatsApp-style chat with a client's AI receptionist. `endpoint` is either the owner's test chat (/api/clients/:id/chat)
 * or the public demo (/api/demo/:token). Polls while a reply is pending.
 */
export function ChatWidget({ endpoint, title, subtitle, placeholder, send, typing, handoffNote, limitNote, suggestions = [], persistKey }: {
  endpoint: string; title: string; subtitle: string; placeholder: string; send: string; typing: string; handoffNote: string; limitNote: string;
  suggestions?: string[]; persistKey?: string;
}) {
  const [sid, setSid] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [handoff, setHandoff] = useState(false);
  const [text, setText] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let s = "";
    try {
      s = (persistKey && localStorage.getItem(persistKey)) || "";
    } catch {
      /* storage blocked */
    }
    if (!s) {
      s = newSid();
      try {
        if (persistKey) localStorage.setItem(persistKey, s);
      } catch {
        /* ignore */
      }
    }
    setSid(s);
  }, [persistKey]);

  const load = useCallback(async () => {
    if (!sid) return;
    const r = await fetch(`${endpoint}?sid=${sid}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    setMsgs(j.messages ?? []);
    setHandoff(Boolean(j.handoff));
    const last = j.messages?.[j.messages.length - 1];
    setWaiting(Boolean(last && last.role === "user" && !j.handoff));
  }, [endpoint, sid]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(load, 1200);
    const stop = setTimeout(() => setWaiting(false), 45_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [waiting, load]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, waiting]);

  async function submit(value: string) {
    const v = value.trim();
    if (!v || !sid) return;
    setText("");
    setError("");
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", text: v, at: new Date().toISOString(), intent: "" }]);
    setWaiting(true);
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid, text: v }) });
    if (r.status === 429) {
      setError(limitNote);
      setWaiting(false);
    }
  }

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-[#0b141a]">
      <div className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#00a884] text-lg">🦷</div>
        <div className="min-w-0">
          <div className="truncate font-bold text-white">{title}</div>
          <div className="truncate text-xs text-[#8696a0]">{waiting ? typing : subtitle}</div>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.03) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
        {msgs.length === 0 && suggestions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-6">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => submit(s)} className="rounded-full border border-[#2a3942] bg-[#111b21] px-3 py-1.5 text-sm text-[#d1d7db] hover:border-[#00a884]" dir="auto">{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div dir="auto" className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[15px] leading-relaxed text-[#e9edef] shadow ${m.role === "user" ? "bg-[#005c4b]" : m.role === "staff" ? "bg-[#3b4a54]" : "bg-[#202c33]"}`}>
              {m.text}
              <div className="mt-1 text-end text-[10px] text-[#8696a0]" dir="ltr">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>
        ))}
        {waiting && <div className="flex justify-start"><div className="rounded-lg bg-[#202c33] px-3 py-2 text-[#8696a0]">•••</div></div>}
        {handoff && <p className="text-center text-xs text-[#ffd279]">{handoffNote}</p>}
        {error && <p className="text-center text-xs text-[#ff8a80]">{error}</p>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void submit(text); }} className="flex items-center gap-2 bg-[#202c33] p-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={placeholder} dir="auto"
          className="min-w-0 flex-1 rounded-full bg-[#2a3942] px-4 py-2.5 text-[15px] text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-2 focus:ring-[#00a884]" />
        <button className="rounded-full bg-[#00a884] px-4 py-2.5 font-bold text-[#0b141a] disabled:opacity-50" disabled={!text.trim()}>{send}</button>
      </form>
    </div>
  );
}
