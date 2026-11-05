export const STAGE_STYLE: Record<string, string> = {
  lead: "bg-ink-3 text-text", proposal: "bg-sky text-ink", assessment: "bg-gold text-gold-ink", pilot: "bg-gold text-gold-ink",
  retainer: "bg-ok text-ink", closed: "bg-ink-3 text-muted", lost: "bg-ink-3 text-muted",
};
export const QUADRANT_STYLE: Record<string, string> = {
  "start-here": "bg-ok text-ink", later: "bg-sky text-ink", "small-win": "bg-gold text-gold-ink", avoid: "bg-ink-3 text-muted",
};
export const usd = (n: number | null | undefined) => (n == null ? "—" : `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en")}`);
/** green when it earns, red when it costs */
export const moneyTone = (n: number | null | undefined) => (n == null ? "text-muted" : n > 0 ? "text-ok" : n < 0 ? "text-coral" : "text-muted");
/** 1–5 score → % along an axis, with the 3.5 cutoff exactly on the quadrant line (high half 8–44 %, low half 56–92 %). */
export const axisPct = (v: number) => (v >= 3.5 ? 8 + ((5 - v) / 1.5) * 36 : 56 + ((3.5 - v) / 2.5) * 36);
