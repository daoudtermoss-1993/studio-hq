"use client";

import { useEffect, useRef, useState } from "react";

export function Teleprompter({ text, labels }: { text: string; labels: Record<"play" | "pause" | "faster" | "slower" | "mirror" | "restart", string> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.2);
  const [size, setSize] = useState(56);
  const [mirror, setMirror] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("tp") ?? "{}");
      if (s.speed) setSpeed(s.speed);
      if (s.size) setSize(s.size);
    } catch { /* private mode */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("tp", JSON.stringify({ speed, size })); } catch { /* ignore */ }
  }, [speed, size]);

  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    let raf = 0;
    const step = (t: number) => {
      if (last !== null && wrap.current) wrap.current.scrollTop += (speed * (t - last)) / 16;
      last = t;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === "ArrowUp") setSpeed((s) => Math.min(6, +(s + 0.2).toFixed(1)));
      if (e.key === "ArrowDown") setSpeed((s) => Math.max(0.2, +(s - 0.2).toFixed(1)));
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 bg-black text-white">
      <div ref={wrap} className="absolute inset-0 overflow-hidden">
        <div className={`bidi whitespace-pre-wrap px-[7vw] pb-[80vh] pt-[45vh] text-center font-bold leading-[1.55] ${mirror ? "-scale-x-100" : ""}`} style={{ fontSize: size }}>
          {text}
        </div>
      </div>
      <div className="pointer-events-none fixed inset-x-0 top-[38vh] border-t-2 border-dashed border-gold/50" />
      <div className="fixed inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 bg-ink-2/95 p-3 text-sm">
        <button className={playing ? "btn-gold" : "btn-ghost"} onClick={() => setPlaying((p) => !p)}>{playing ? `⏸ ${labels.pause}` : `▶ ${labels.play}`}</button>
        <button className="btn-ghost" onClick={() => setSpeed((s) => Math.max(0.2, +(s - 0.2).toFixed(1)))}>− {labels.slower}</button>
        <span className="self-center font-mono text-muted" dir="ltr">{speed.toFixed(1)}×</span>
        <button className="btn-ghost" onClick={() => setSpeed((s) => Math.min(6, +(s + 0.2).toFixed(1)))}>+ {labels.faster}</button>
        <button className="btn-ghost" onClick={() => setSize((s) => Math.max(24, s - 6))}>A−</button>
        <button className="btn-ghost" onClick={() => setSize((s) => Math.min(120, s + 6))}>A+</button>
        <button className={mirror ? "btn-gold" : "btn-ghost"} onClick={() => setMirror((m) => !m)}>{labels.mirror}</button>
        <button className="btn-ghost" onClick={() => wrap.current && (wrap.current.scrollTop = 0)}>↺ {labels.restart}</button>
      </div>
    </div>
  );
}
