import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { connect as tlsConnect } from "node:tls";

/**
 * Website audit engine: every number here is MEASURED (PageSpeed Insights + our own passive checks of the public homepage),
 * never produced by a model. The web-auditor agent explains these facts; it does not invent them.
 * Passive only: one homepage fetch, robots.txt respected, no vulnerability scanning of sites we don't own.
 */

export interface HtmlSignals {
  title: string;
  metaDescription: string;
  viewport: boolean;
  lang: string;
  h1Count: number;
  imgCount: number;
  imgNoAlt: number;
  scriptCount: number;
  whatsapp: boolean;
  tel: boolean;
  booking: boolean;
  form: boolean;
  mapsEmbed: boolean;
  jsonLdTypes: string[];
  openGraph: boolean;
  copyrightYear: number | null;
  mixedContent: number;
  generator: string;
  socials: string[];
  /** booking / telehealth / directory / social platforms the site links to (drapp, vezeeta, calendly, instagram…) */
  platforms: string[];
  textSample: string;
}

export interface PsiResult {
  strategy: "mobile" | "desktop";
  performance: number | null;
  accessibility: number | null;
  seo: number | null;
  bestPractices: number | null;
  lcpMs: number | null;
  fcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  speedIndexMs: number | null;
  totalBytes: number | null;
  field: { lcpMs: number | null; inpMs: number | null; cls: number | null; category: string } | null;
  screenshot: string | null;
  opportunities: { id: string; title: string; savingsMs: number }[];
}

export interface SiteFacts {
  url: string;
  finalUrl: string;
  reachable: boolean;
  status: number | null;
  error: string;
  https: boolean;
  httpRedirectsToHttps: boolean | null;
  tls: { valid: boolean; daysLeft: number | null; issuer: string } | null;
  ttfbMs: number | null;
  htmlKb: number | null;
  robotsBlocked: boolean;
  html: HtmlSignals | null;
  psi: PsiResult | null;
  measuredAt: string;
}

export type Severity = "critical" | "high" | "medium" | "low";
export type Area = "speed" | "mobile" | "trust" | "conversion" | "seo";
export interface Finding {
  id: string;
  severity: Severity;
  area: Area;
  evidence: string;
}

export interface SiteScore {
  score: number;
  areas: Record<Area, number>;
  findings: Finding[];
}

const UA = "Mozilla/5.0 (compatible; StudioHQ-SiteCheck/1.0; one-time public homepage check)";
const MAX_BYTES = 2_000_000;

// ---------- safety: only public hosts (no SSRF into the server's own network) ----------

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? privateIp(m[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Throws unless the URL is http(s) on a default port and resolves only to public addresses. */
export async function assertPublicUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("only http(s) URLs");
  if (u.username || u.password) throw new Error("credentials in URL are not allowed");
  if (process.env.AUDIT_ALLOW_PRIVATE === "1") return u;
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("non-standard port");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("private host");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error("private address");
  return u;
}

/** fetch with manual redirects (each hop re-checked), a timeout and a size cap. */
export async function safeFetch(raw: string, timeoutMs = 15_000) {
  let url = raw;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicUrl(url);
    const t0 = performance.now();
    const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(timeoutMs) });
    const ttfb = Math.round(performance.now() - t0);
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url).toString();
      await res.body?.cancel();
      continue;
    }
    let body = "";
    if (res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (size < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
      }
      await reader.cancel().catch(() => {});
      body = Buffer.concat(chunks).toString("utf8");
    }
    return { res, url, ttfb, body };
  }
  throw new Error("too many redirects");
}

// ---------- pure analysis ----------

export const PLATFORM_PATTERNS: [string, RegExp][] = [
  ["drapp", /drapp\.me/i], ["vezeeta", /vezeeta\.com/i], ["okadoc", /okadoc\.com/i], ["doctify", /doctify\.com/i], ["whatclinic", /whatclinic\.com/i],
  ["calendly", /calendly\.com/i], ["cal.com", /cal\.com\//i], ["setmore", /setmore\.com/i], ["booksy", /booksy\.com/i], ["fresha", /fresha\.com/i],
  ["linktree", /linktr\.ee/i], ["google-maps", /g\.page|maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps/i], ["whatsapp", /wa\.me|api\.whatsapp\.com/i],
  ["instagram", /instagram\.com/i], ["facebook", /facebook\.com|fb\.me/i], ["tiktok", /tiktok\.com/i],
];
export const platformsIn = (links: string[]) => PLATFORM_PATTERNS.filter(([, re]) => links.some((l) => re.test(l))).map(([id]) => id);

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";

export function analyzeHtml(html: string, pageUrl: string): HtmlSignals {
  const head = html.slice(0, 400_000);
  const metas = head.match(/<meta\b[^>]*>/gi) ?? [];
  const meta = (key: string) => {
    const m = metas.find((t) => new RegExp(`(name|property)\\s*=\\s*["']${key}["']`, "i").test(t));
    return m ? attr(m, "content") : "";
  };
  const imgs = head.match(/<img\b[^>]*>/gi) ?? [];
  const links = (head.match(/href\s*=\s*["']([^"']+)["']/gi) ?? []).map((h) => h.replace(/^href\s*=\s*["']|["']$/gi, ""));
  const jsonLdTypes = [...head.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) =>
    [...m[1].matchAll(/"@type"\s*:\s*(?:"([^"]+)"|\[([^\]]+)\])/g)].flatMap((x) => (x[1] ? [x[1]] : x[2].split(",").map((s) => s.replace(/["\s]/g, "")))),
  );
  const text = head.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const years = [...text.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/gi)].map((m) => Number(m[1]));
  const https = pageUrl.startsWith("https:");
  return {
    title: (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
    metaDescription: meta("description").slice(0, 300),
    viewport: /width\s*=\s*device-width/i.test(meta("viewport")),
    lang: attr(head.match(/<html\b[^>]*>/i)?.[0] ?? "", "lang"),
    h1Count: (head.match(/<h1\b/gi) ?? []).length,
    imgCount: imgs.length,
    imgNoAlt: imgs.filter((t) => !/\balt\s*=\s*["'][^"']+["']/i.test(t)).length,
    scriptCount: (head.match(/<script\b/gi) ?? []).length,
    whatsapp: links.some((l) => /wa\.me|api\.whatsapp\.com|whatsapp:\/\//i.test(l)),
    tel: links.some((l) => /^tel:/i.test(l)),
    booking: /calendly|cal\.com|booksy|setmore|fresha|simplybook|book(ing)?[-_ ]?(now|appointment)|احجز|حجز موعد|prendre rendez-vous|rendez-vous/i.test(head),
    form: /<form\b/i.test(head),
    mapsEmbed: /google\.[a-z.]+\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(head),
    jsonLdTypes: [...new Set(jsonLdTypes)].slice(0, 12),
    openGraph: Boolean(meta("og:title") || meta("og:image")),
    copyrightYear: years.length ? Math.max(...years) : null,
    mixedContent: https ? (head.match(/\b(?:src|href)\s*=\s*["']http:\/\/[^"']+\.(?:js|css|png|jpe?g|gif|webp|svg)/gi) ?? []).length : 0,
    generator: meta("generator").slice(0, 80),
    socials: [...new Set(links.map((l) => l.match(/(facebook|instagram|tiktok|linkedin|youtube)\.com/i)?.[1]?.toLowerCase()).filter(Boolean) as string[])],
    platforms: platformsIn(links),
    textSample: text.slice(0, 1500),
  };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Deterministic score (0-100) and findings from measured facts. Weights: speed 35, conversion 20, trust 15, mobile 15, seo 15. */
export function scoreSite(f: SiteFacts, now = new Date()): SiteScore {
  const findings: Finding[] = [];
  const add = (id: string, severity: Severity, area: Area, evidence: string) => findings.push({ id, severity, area, evidence });
  if (!f.reachable) {
    add("site-down", "critical", "trust", f.error || `HTTP ${f.status ?? "?"}`);
    return { score: 0, areas: { speed: 0, mobile: 0, trust: 0, conversion: 0, seo: 0 }, findings };
  }
  const p = f.psi;
  const h = f.html;

  // speed (0-100 inside the area)
  let speed = p?.performance ?? (f.ttfbMs == null ? 50 : f.ttfbMs < 600 ? 80 : f.ttfbMs < 1500 ? 55 : 25);
  const lcp = p?.field?.lcpMs ?? p?.lcpMs ?? null;
  if (lcp != null && lcp > 4000) add("slow-lcp", "critical", "speed", `LCP ${(lcp / 1000).toFixed(1)}s`);
  else if (lcp != null && lcp > 2500) add("slow-lcp", "high", "speed", `LCP ${(lcp / 1000).toFixed(1)}s`);
  if (p?.performance != null && p.performance < 50) add("low-performance", "high", "speed", `PageSpeed ${p.performance}/100`);
  else if (p?.performance != null && p.performance < 90) add("low-performance", "medium", "speed", `PageSpeed ${p.performance}/100`);
  if (p?.tbtMs != null && p.tbtMs > 600) add("blocking-js", "medium", "speed", `TBT ${Math.round(p.tbtMs)}ms`);
  const cls = p?.field?.cls ?? p?.cls ?? null;
  if (cls != null && cls > 0.25) add("layout-shift", "high", "mobile", `CLS ${cls.toFixed(2)}`);
  else if (cls != null && cls > 0.1) add("layout-shift", "medium", "mobile", `CLS ${cls.toFixed(2)}`);
  if (p?.totalBytes != null && p.totalBytes > 3_000_000) add("heavy-page", "medium", "speed", `${(p.totalBytes / 1_048_576).toFixed(1)} MB`);
  if (f.ttfbMs != null && f.ttfbMs > 1500) {
    add("slow-server", "medium", "speed", `TTFB ${f.ttfbMs}ms`);
    speed = Math.min(speed, 60);
  }

  // trust
  let trust = 100;
  if (!f.https) { add("no-https", "critical", "trust", f.finalUrl); trust -= 60; }
  else if (f.tls && !f.tls.valid) { add("tls-invalid", "critical", "trust", f.tls.issuer || "invalid certificate"); trust -= 60; }
  else if (f.tls?.daysLeft != null && f.tls.daysLeft < 21) { add("tls-expiring", "high", "trust", `${f.tls.daysLeft} days`); trust -= 25; }
  if (f.https && f.httpRedirectsToHttps === false) { add("no-https-redirect", "medium", "trust", "http:// stays on http"); trust -= 15; }
  if (h?.mixedContent) { add("mixed-content", "high", "trust", `${h.mixedContent} http:// resources`); trust -= 15; }
  if (h?.copyrightYear && h.copyrightYear < now.getFullYear() - 1) { add("looks-abandoned", "low", "trust", `© ${h.copyrightYear}`); trust -= 10; }

  // mobile
  let mobile = p?.accessibility ?? 80;
  if (h && !h.viewport) { add("no-mobile", "high", "mobile", "no viewport meta"); mobile = Math.min(mobile, 30); }

  // conversion (what a patient/customer needs to act in 5 seconds)
  let conversion = 0;
  if (h) {
    conversion = (h.whatsapp ? 40 : 0) + (h.tel ? 25 : 0) + (h.booking ? 25 : 0) + (h.form ? 10 : 0);
    if (!h.whatsapp) add("no-whatsapp", "high", "conversion", "no wa.me link");
    if (!h.tel) add("no-call-button", "medium", "conversion", "no tel: link");
    if (!h.booking) add("no-booking", "medium", "conversion", "no online booking");
  } else conversion = 40;

  // seo (local)
  let seo = p?.seo ?? 70;
  if (h) {
    if (!h.title || h.title.length < 10) { add("weak-title", "medium", "seo", h.title || "empty"); seo -= 15; }
    if (!h.metaDescription) { add("no-description", "medium", "seo", "no meta description"); seo -= 10; }
    if (h.h1Count === 0) { add("no-h1", "low", "seo", "0 h1"); seo -= 5; }
    if (!h.jsonLdTypes.some((t) => /LocalBusiness|Dentist|MedicalBusiness|MedicalClinic|Physician|Restaurant|Store|Organization/i.test(t))) {
      add("no-local-schema", "medium", "seo", h.jsonLdTypes.join(", ") || "none"); seo -= 10;
    }
    if (h.imgNoAlt > 3) { add("images-no-alt", "low", "seo", `${h.imgNoAlt}/${h.imgCount}`); seo -= 5; }
  }
  if (f.robotsBlocked) add("robots-blocked", "low", "seo", "robots.txt blocks crawlers");

  const areas = { speed: clamp(speed), mobile: clamp(mobile), trust: clamp(trust), conversion: clamp(conversion), seo: clamp(seo) };
  const score = clamp(areas.speed * 0.35 + areas.conversion * 0.2 + areas.trust * 0.15 + areas.mobile * 0.15 + areas.seo * 0.15);
  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { score, areas, findings };
}

// ---------- measurements ----------

function checkTls(host: string): Promise<SiteFacts["tls"]> {
  return new Promise((resolve) => {
    const sock = tlsConnect({ host, port: 443, servername: host, timeout: 8000 }, () => {
      const c = sock.getPeerCertificate();
      const daysLeft = c?.valid_to ? Math.floor((Date.parse(c.valid_to) - Date.now()) / 86_400_000) : null;
      resolve({ valid: sock.authorized, daysLeft, issuer: String((c?.issuer as any)?.O ?? (c?.issuer as any)?.CN ?? "") });
      sock.end();
    });
    sock.on("error", (e) => resolve({ valid: false, daysLeft: null, issuer: e.message.slice(0, 80) }));
    sock.on("timeout", () => { sock.destroy(); resolve(null); });
  });
}

async function robotsBlocks(origin: string) {
  try {
    const { res, body } = await safeFetch(`${origin}/robots.txt`, 6000);
    if (!res.ok) return false;
    let applies = false;
    for (const line of body.split(/\r?\n/)) {
      const [k, ...rest] = line.split(":");
      const v = rest.join(":").trim();
      if (/^user-agent$/i.test(k.trim())) applies = v === "*" || /studiohq/i.test(v);
      else if (applies && /^disallow$/i.test(k.trim()) && v === "/") return true;
    }
  } catch {
    /* no robots.txt → allowed */
  }
  return false;
}

/** Google PageSpeed Insights v5 (works keyless at a low quota; PAGESPEED_API_KEY raises it). */
export async function runPageSpeed(url: string, strategy: "mobile" | "desktop" = "mobile"): Promise<PsiResult> {
  const u = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  u.searchParams.set("url", url);
  u.searchParams.set("strategy", strategy);
  for (const c of ["performance", "accessibility", "seo", "best-practices"]) u.searchParams.append("category", c);
  if (process.env.PAGESPEED_API_KEY) u.searchParams.set("key", process.env.PAGESPEED_API_KEY);
  const res = await fetch(u, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`PageSpeed ${res.status}`);
  const j: any = await res.json();
  const cat = (k: string) => (j.lighthouseResult?.categories?.[k]?.score == null ? null : Math.round(j.lighthouseResult.categories[k].score * 100));
  const a = j.lighthouseResult?.audits ?? {};
  const num = (k: string) => (typeof a[k]?.numericValue === "number" ? a[k].numericValue : null);
  const le = j.loadingExperience?.metrics;
  return {
    strategy,
    performance: cat("performance"), accessibility: cat("accessibility"), seo: cat("seo"), bestPractices: cat("best-practices"),
    lcpMs: num("largest-contentful-paint"), fcpMs: num("first-contentful-paint"), tbtMs: num("total-blocking-time"),
    cls: num("cumulative-layout-shift"), speedIndexMs: num("speed-index"), totalBytes: num("total-byte-weight"),
    field: le
      ? {
          lcpMs: le.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
          inpMs: le.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
          cls: le.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null ? le.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
          category: j.loadingExperience?.overall_category ?? "",
        }
      : null,
    screenshot: typeof a["final-screenshot"]?.details?.data === "string" ? a["final-screenshot"].details.data : null,
    opportunities: Object.values(a)
      .filter((x: any) => x?.details?.type === "opportunity" && (x.details.overallSavingsMs ?? 0) > 300)
      .map((x: any) => ({ id: x.id, title: x.title, savingsMs: Math.round(x.details.overallSavingsMs) }))
      .sort((p: any, q: any) => q.savingsMs - p.savingsMs)
      .slice(0, 6),
  };
}

/** Measure one public website. `psi: false` skips PageSpeed (tests, or when the quota is exhausted). */
export async function inspectSite(raw: string, opts: { psi?: boolean } = {}): Promise<SiteFacts> {
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const facts: SiteFacts = {
    url, finalUrl: url, reachable: false, status: null, error: "", https: false, httpRedirectsToHttps: null, tls: null,
    ttfbMs: null, htmlKb: null, robotsBlocked: false, html: null, psi: null, measuredAt: new Date().toISOString(),
  };
  await assertPublicUrl(url);
  const origin = new URL(url).origin;
  facts.robotsBlocked = await robotsBlocks(origin);
  try {
    const { res, url: finalUrl, ttfb, body } = await safeFetch(url);
    facts.finalUrl = finalUrl;
    facts.status = res.status;
    facts.reachable = res.ok;
    facts.ttfbMs = ttfb;
    facts.https = finalUrl.startsWith("https:");
    facts.htmlKb = Math.round(Buffer.byteLength(body) / 1024);
    if (res.ok && !facts.robotsBlocked && /html/i.test(res.headers.get("content-type") ?? "html")) facts.html = analyzeHtml(body, finalUrl);
  } catch (e) {
    facts.error = String((e as Error).message).slice(0, 160);
  }
  if (facts.https) {
    const host = new URL(facts.finalUrl).hostname;
    facts.tls = await checkTls(host);
    try {
      const plain = await fetch(`http://${host}/`, { redirect: "manual", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
      facts.httpRedirectsToHttps = (plain.headers.get("location") ?? "").startsWith("https:");
      await plain.body?.cancel();
    } catch {
      facts.httpRedirectsToHttps = null;
    }
  }
  if (facts.reachable && opts.psi !== false) {
    try {
      facts.psi = await runPageSpeed(facts.finalUrl, "mobile");
    } catch (e) {
      facts.error = `${facts.error} PageSpeed: ${String((e as Error).message).slice(0, 80)}`.trim();
    }
  }
  return facts;
}

/** Deterministic facts for mock mode (demo + tests): "fast" in the URL = a healthy site. */
export function mockSiteFacts(url: string): SiteFacts {
  const healthy = /fast|good/i.test(url);
  return {
    url, finalUrl: url, reachable: true, status: 200, error: "", https: true, httpRedirectsToHttps: healthy,
    tls: { valid: true, daysLeft: healthy ? 80 : 12, issuer: "Let's Encrypt" }, ttfbMs: healthy ? 240 : 1900, htmlKb: healthy ? 38 : 410,
    robotsBlocked: false, measuredAt: new Date().toISOString(),
    html: {
      title: healthy ? "Smile Center Beirut — Dental clinic" : "Home", metaDescription: healthy ? "Dental clinic in Hamra, Beirut" : "",
      viewport: healthy, lang: healthy ? "en" : "", h1Count: healthy ? 1 : 0, imgCount: 14, imgNoAlt: healthy ? 0 : 11, scriptCount: healthy ? 3 : 22,
      whatsapp: healthy, tel: true, booking: healthy, form: healthy, mapsEmbed: true, jsonLdTypes: healthy ? ["Dentist"] : [], openGraph: healthy,
      copyrightYear: healthy ? new Date().getFullYear() : 2019, mixedContent: healthy ? 0 : 3, generator: healthy ? "" : "WordPress 5.2",
      socials: ["facebook", "instagram"], platforms: healthy ? ["whatsapp", "instagram", "facebook", "calendly"] : ["instagram", "facebook", "drapp"], textSample: "Dental clinic. Implants, whitening, orthodontics. Call us.",
    },
    psi: {
      strategy: "mobile", performance: healthy ? 94 : 23, accessibility: healthy ? 92 : 61, seo: healthy ? 95 : 58, bestPractices: healthy ? 96 : 52,
      lcpMs: healthy ? 1800 : 9400, fcpMs: healthy ? 900 : 4200, tbtMs: healthy ? 90 : 1800, cls: healthy ? 0.02 : 0.31, speedIndexMs: healthy ? 1500 : 8800,
      totalBytes: healthy ? 900_000 : 6_400_000, field: null, screenshot: null,
      opportunities: healthy ? [] : [
        { id: "modern-image-formats", title: "Serve images in modern formats", savingsMs: 3900 },
        { id: "render-blocking-resources", title: "Eliminate render-blocking resources", savingsMs: 1700 },
      ],
    },
  };
}
