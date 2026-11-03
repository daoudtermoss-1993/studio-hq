"use client";

import { useEffect, useRef, useState } from "react";
import type { OfficeState } from "@studio/core";

type Agent = OfficeState["agents"][number];
export interface OfficeLabels {
  library: string; lessonsLearned: string; noMeetingYet: string; lastMeeting: string; meetingRoom: string;
  weeklyMeeting: string; booth: string; you: string; toRecord: string; working: string; tasks: string;
  strategyRoom: string; weeklyFocus: string;
}

const FRAMES = {
  idle: ["....HHHH....", "...HHHHHH...", "..HHSSSSHH..", "...SESSES...", "...SSSSSS...", "....SSSS....", "..BBBTTBBB..", ".BBBBTTBBBB.", ".BBBBBBBBBB.", ".SBBBBBBBBS.", ".SBBBBBBBBS.", "..BBBBBBBB..", "..BBBBBBBB..", "..BBBBBBBB.."],
  a: ["....HHHH....", "...HHHHHH...", "..HHSSSSHH..", "...SESSES...", "...SSSSSS...", "....SSSS....", "..BBBTTBBB..", ".BBBBTTBBBB.", ".BBBBBBBBBB.", "SSBBBBBBBBB.", ".BBBBBBBBBSS", "..BBBBBBBB..", "..BBBBBBBB..", "..BBBBBBBB.."],
  b: ["....HHHH....", "...HHHHHH...", "..HHSSSSHH..", "...SESSES...", "...SSSSSS...", "....SSSS....", "..BBBTTBBB..", ".BBBBTTBBBB.", ".BBBBBBBBBB.", ".BBBBBBBBBSS", "SSBBBBBBBBB.", "..BBBBBBBB..", "..BBBBBBBB..", "..BBBBBBBB.."],
};
const FLOORS: Record<string, string> = {
  wood: "repeating-conic-gradient(#6b4a2f 0 25%,#5f4129 0 50%) 0 0/24px 24px",
  blue: "repeating-conic-gradient(#2f3f73 0 25%,#293763 0 50%) 0 0/24px 24px",
  green: "repeating-conic-gradient(#2e6a49 0 25%,#285e41 0 50%) 0 0/24px 24px",
  gold: "repeating-conic-gradient(#7a5a2c 0 25%,#6d5027 0 50%) 0 0/24px 24px",
};
const ME = { hair: "#111111", skin: "#b8805a", body: "#7a2f4a" };

function Sprite({ look, active }: { look: { hair: string; skin: string; body: string; tie?: string }; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = (rows: string[]) => {
      const ctx = ref.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, 12, 14);
      const pal: Record<string, string> = { H: look.hair, S: look.skin, E: "#121212", B: look.body, T: look.tie ?? look.body };
      rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== ".") { ctx.fillStyle = pal[c]; ctx.fillRect(x, y, 1, 1); } }));
    };
    draw(FRAMES.idle);
    if (!active) return;
    const id = setInterval(() => { frame ^= 1; draw(frame ? FRAMES.a : FRAMES.b); }, 280);
    return () => clearInterval(id);
  }, [look, active]);
  return <canvas ref={ref} width={12} height={14} className="relative z-[1] mt-1 h-[70px] w-[60px] [image-rendering:pixelated]" aria-hidden />;
}

function Room({ title, floor, children, on }: { title: string; floor: string; children: React.ReactNode; on?: boolean }) {
  return (
    <div className={`relative min-h-[236px] overflow-hidden border-[3px] border-[#2a2e50] ${on ? "is-on" : ""}`} style={{ background: FLOORS[floor] ?? FLOORS.wood }}>
      <div className="flex h-[34px] items-center justify-center border-b-4 border-[#171a33] bg-gradient-to-b from-[#3b4070] to-[#2a2e50]">
        <span className="max-w-[92%] truncate border-2 border-[#4b5191] bg-[#10132a] px-2 text-xs font-bold text-[#d6d9f7]">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Desk({ on, mic }: { on: boolean; mic?: boolean }) {
  return (
    <div className="relative z-[2] -mt-[26px] h-[30px] w-[150px] max-w-full border-t-[7px] border-[#a86f40] bg-[#8a5a33] shadow-[0_5px_0_#3b2614]">
      <div className="absolute end-2.5 -top-[30px] h-6 w-[34px] overflow-hidden border-[3px] border-[#4a4f5c] bg-[#0d0f14]">
        {on && <div className="absolute inset-[3px] opacity-90 [animation:scrolllines_.6s_steps(3)_infinite] [background:repeating-linear-gradient(#47d18c_0_2px,transparent_2px_5px)]" />}
      </div>
      {mic ? (
        <div className="absolute start-[18px] -top-11 h-10 w-1.5 bg-[#3a3f4e]"><div className="absolute -start-[5px] -top-3 h-4 w-4 rounded-full border-2 border-[#3a3f4e] bg-[#9aa0b4]" /></div>
      ) : (
        <div className={`absolute start-3.5 -top-[22px] h-3 w-3 border-2 ${on ? "border-[#a5821c] bg-[#ffd54a] shadow-[0_0_10px_5px_rgba(255,213,74,.6),0_0_46px_22px_rgba(255,213,74,.2)]" : "border-[#2b2e38] bg-[#5a5f6e]"}`} />
      )}
    </div>
  );
}

function Bubble({ text, show }: { text: string; show: boolean }) {
  return (
    <div className={`flex min-h-10 max-w-full items-end justify-center ${show ? "visible" : "invisible"}`}>
      <span className="relative max-w-[200px] rounded-[3px] border-2 border-[#141830] bg-white px-2 py-1 text-xs font-bold leading-snug text-[#141830] after:absolute after:start-1/2 after:-bottom-2 after:-ms-[5px] after:border-[5px] after:border-transparent after:border-t-[#141830]">
        <span className="bidi line-clamp-2">{text}</span>
      </span>
    </div>
  );
}

function Station({ a, locale, labels }: { a: Agent; locale: string; labels: OfficeLabels }) {
  const [pop, setPop] = useState(false);
  const last = useRef(a.level);
  useEffect(() => {
    if (a.level > last.current) {
      setPop(true);
      const id = setTimeout(() => setPop(false), 3500);
      last.current = a.level;
      return () => clearTimeout(id);
    }
    last.current = a.level;
  }, [a.level]);
  const name = locale === "ar" ? a.nameAr : a.nameEn;
  return (
    <Room title={locale === "ar" ? a.roomAr : a.roomEn} floor={a.look.floor} on={a.active}>
      {pop && <div className="absolute left-1/2 top-[42px] z-10 -translate-x-1/2 border-2 border-[#141830] bg-gold px-2 py-1.5 font-pixel text-[9px] text-[#141830] [animation:pop_3.5s_ease_forwards]">LEVEL UP ⬆</div>}
      <div className="flex flex-col items-center px-2 pb-2.5 pt-1.5" title={`${a.done} ${labels.tasks} · ${a.lessons} · ${a.xp} XP`}>
        <Bubble text={a.task || labels.working} show={a.active} />
        <Sprite look={a.look} active={a.active} />
        <Desk on={a.active} />
        <div className="mt-3 flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-sm bg-[#0a0c1a]/80 px-2 py-0.5">
          <span className="whitespace-nowrap text-[13px] font-bold">{name}</span>
          <span className="whitespace-nowrap rounded-sm bg-gold px-1 py-[3px] font-pixel text-[7px] text-[#141830]" dir="ltr">LV {a.level} · {(locale === "ar" ? a.titleAr : a.titleEn).toUpperCase()}</span>
        </div>
        <div className="mt-1.5 h-[7px] w-[130px] max-w-full border-2 border-[#0b0e1d] bg-[#0b0e1d]" dir="ltr">
          <i className="block h-full bg-gradient-to-r from-[#4f7cff] to-[#7aa2ff] transition-all" style={{ width: `${Math.round(a.progress * 100)}%` }} />
        </div>
        <div className={`mt-1.5 min-h-[18px] max-w-full truncate bg-[#0a0c1a]/70 px-1.5 font-mono text-[11px] text-[#cfd3f5] ${a.active && a.tool ? "visible" : "invisible"}`} dir="ltr">{a.tool}</div>
      </div>
    </Room>
  );
}

export function Office({ initial, locale, labels, poll = true }: { initial: OfficeState; locale: string; labels: OfficeLabels; poll?: boolean }) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    if (!poll) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/office", { cache: "no-store" });
        if (r.ok && alive) setS(await r.json());
      } catch { /* offline: keep last state */ }
    };
    const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); };
  }, [poll]);

  const by = Object.fromEntries(s.agents.map((a) => [a.id, a]));
  const order = ["ceo", "strategy", "trend-scout", "viral-hunter", "viral-analyst", "content-strategist", "hook-writer", "scriptwriter",
    "fact-checker", "booth", "digital-twin", "video-editor", "caption-writer", "cover-designer", "scheduler", "repurposer",
    "analyst", "community-manager", "problem-hunter", "chief-engineer", "automation-engineer", "ai-engineer",
    "network-engineer", "software-engineer", "security-reviewer", "outreach-writer", "opportunity-scout", "web-auditor", "web-designer", "knowledge-engineer", "receptionist", "qa-engineer",
    "care-coordinator", "reputation-manager", "growth-marketer", "client-success", "library", "meeting"];
  const onAir = s.booth.toRecord > 0;
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(locale === "ar" ? "ar-LB" : "en-GB", { weekday: "long", day: "numeric", month: "short" });

  return (
    <section aria-label="office" className="grid grid-cols-2 gap-1.5 rounded border-4 border-[#3b4070] bg-[#080b16] p-1.5 md:grid-cols-4">
      {order.map((id) => {
        if (id === "booth")
          return (
            <Room key={id} title={labels.booth} floor="green" on={onAir}>
              <div className={`absolute left-1/2 top-[42px] -translate-x-1/2 border-2 px-1.5 py-1 font-pixel text-[8px] ${onAir ? "border-[#ffb3bb] bg-coral text-white shadow-[0_0_14px_rgba(255,77,94,.7)]" : "border-[#5a1f28] bg-[#3a1016] text-[#7a3a44]"}`}>ON AIR</div>
              <div className="flex flex-col items-center px-2 pb-2.5 pt-8">
                <Bubble text={labels.toRecord.replace("{n}", String(s.booth.toRecord))} show={onAir} />
                <Sprite look={ME} active={onAir} />
                <Desk on={onAir} mic />
                <span className="mt-3 rounded-sm bg-[#0a0c1a]/80 px-2 text-[13px] font-bold">{labels.you}</span>
              </div>
            </Room>
          );
        if (id === "strategy")
          return (
            <Room key={id} title={labels.strategyRoom} floor="gold">
              <div className="mx-3 mt-4 rounded border-4 border-[#5a3d1e] bg-[#f6f3ec] p-2 text-[#1b2140] shadow-[0_4px_0_#2b1c0d]">
                <p className="font-pixel text-[8px] text-[#8f600a]">{labels.weeklyFocus.toUpperCase()}</p>
                <p className="bidi mt-1 line-clamp-4 text-[13px] font-bold leading-snug">{s.strategy?.weeklyFocus || "—"}</p>
              </div>
              <div className="mt-3 flex justify-center gap-2" aria-hidden>
                {["#ff4d5e", "#47d18c", "#7aa2ff"].map((c) => <div key={c} className="h-6 w-6 border-2 border-[#141830]" style={{ background: c }} />)}
              </div>
            </Room>
          );
        if (id === "library")
          return (
            <Room key={id} title={labels.library} floor="blue">
              <div className="grid grid-cols-3 gap-2 px-3.5 pb-1.5 pt-3.5">
                {[0, 1, 2].map((i) => <div key={i} className="h-10 border-b-[5px] border-[#4a2e18] [background:repeating-linear-gradient(90deg,#c0392b_0_6px,#2e86de_6px_12px,#f1c40f_12px_17px,#27ae60_17px_23px,#8e44ad_23px_28px,#0000_28px_31px)]" />)}
              </div>
              <div className="px-2.5 py-1 text-center">
                <div className="font-pixel text-xl text-gold">{s.library.lessons}</div>
                <div className="mt-1.5 inline-block bg-[#0a0c1a]/75 px-2 text-[13px] font-semibold">{labels.lessonsLearned}</div>
                <div className="mt-1.5 text-xs text-[#cfd3f5]">{s.library.lastRetro ? `${labels.lastMeeting}: ${dateFmt(s.library.lastRetro)}` : labels.noMeetingYet}</div>
              </div>
            </Room>
          );
        if (id === "meeting")
          return (
            <Room key={id} title={labels.meetingRoom} floor="green">
              <div className="relative mx-auto mb-2 mt-6 h-[46px] w-[70%] border-t-[7px] border-[#a86f40] bg-[#8a5a33] shadow-[0_5px_0_#3b2614]" />
              <div className="mt-6 text-center"><span className="inline-block bg-[#0a0c1a]/75 px-2 text-[13px] font-semibold">{labels.weeklyMeeting}</span></div>
            </Room>
          );
        const a = by[id];
        return a ? <Station key={id} a={a} locale={locale} labels={labels} /> : null;
      })}
    </section>
  );
}
