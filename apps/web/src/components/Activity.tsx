"use client";

import { useEffect, useState } from "react";
import type { OfficeState } from "@studio/core";

export function Activity({ initial, names, title, empty }: { initial: OfficeState["activity"]; names: Record<string, string>; title: string; empty: string }) {
  const [items, setItems] = useState(initial);
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/office", { cache: "no-store" });
        if (r.ok) setItems((await r.json()).activity);
      } catch { /* keep */ }
    }, 4000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="card">
      <h2 className="font-display text-lg font-extrabold text-gold">📜 {title}</h2>
      <ul className="mt-2 max-h-[340px] divide-y divide-line overflow-auto text-sm">
        {items.length === 0 && <li className="py-2 text-muted">{empty}</li>}
        {items.map((a, i) => (
          <li key={i} className="grid grid-cols-[44px_1fr] gap-2 py-1.5">
            <span className="pt-0.5 font-mono text-[11px] text-muted" dir="ltr">
              {new Date(a.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="bidi"><b className="text-gold">{names[a.actor] ?? a.actor}</b> {a.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
