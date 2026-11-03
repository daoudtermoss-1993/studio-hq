import { env } from "./env";

/** A local business we might help (from Google Places or from web search). */
export interface Business {
  placeId: string | null;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string;
  source: "google-maps" | "web";
}

const FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.websiteUri", "places.internationalPhoneNumber",
  "places.rating", "places.userRatingCount", "places.googleMapsUri", "places.businessStatus",
].join(",");

/**
 * Google Places API (New) Text Search. Needs GOOGLE_MAPS_API_KEY with "Places API (New)" enabled.
 * Terms: only place_id may be kept long-term; we clear the other Google fields after 30 days (see purgeGoogleData).
 */
export async function searchPlaces(textQuery: string, opts: { region?: string; language?: string; max?: number } = {}): Promise<Business[]> {
  if (env.aiProvider === "mock") return mockBusinesses();
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return [];
  const out: Business[] = [];
  let pageToken: string | undefined;
  const max = Math.min(opts.max ?? 20, 60);
  do {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": `${FIELDS},nextPageToken` },
      body: JSON.stringify({ textQuery, pageSize: Math.min(20, max - out.length), languageCode: opts.language ?? "ar", regionCode: opts.region ?? "LB", ...(pageToken ? { pageToken } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const j: any = await res.json();
    for (const p of j.places ?? []) {
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
      out.push({
        placeId: p.id, name: p.displayName?.text ?? "", address: p.formattedAddress ?? "", phone: p.internationalPhoneNumber ?? "",
        website: p.websiteUri ?? "", rating: p.rating ?? null, reviews: p.userRatingCount ?? null,
        mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`, source: "google-maps",
      });
    }
    pageToken = j.nextPageToken;
  } while (pageToken && out.length < max);
  return out.slice(0, max);
}

export function mockBusinesses(): Business[] {
  return [
    { placeId: "mock-place-1", name: "عيادة د. سمير للأسنان", address: "الحمرا، بيروت", phone: "+961 1 000 001", website: "https://dr-samir-dental.example", rating: 4.6, reviews: 87, mapsUrl: "https://www.google.com/maps/place/?q=place_id:mock-place-1", source: "google-maps" },
    { placeId: "mock-place-2", name: "Smile Center Beirut", address: "Achrafieh, Beirut", phone: "+961 1 000 002", website: "https://smilecenter-fast.example", rating: 4.8, reviews: 312, mapsUrl: "https://www.google.com/maps/place/?q=place_id:mock-place-2", source: "google-maps" },
    { placeId: "mock-place-3", name: "عيادة الأرز لطب الأسنان", address: "فردان، بيروت", phone: "+961 3 000 003", website: "", rating: 4.4, reviews: 41, mapsUrl: "https://www.google.com/maps/place/?q=place_id:mock-place-3", source: "google-maps" },
  ];
}

// ---------- mockup safety + quality gate ----------

/** Removes anything executable from model-written HTML (defense in depth; the preview is also served with a sandbox CSP). */
export function sanitizeMockup(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/<(iframe|object|embed|base)\b[^>]*>/gi, "")
    .replace(/<form\b[^>]*>/gi, "<form>")
    .replace(/<\/(iframe|object|embed)>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|action)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(/<meta\b[^>]*http-equiv[^>]*>/gi, "");
}

/** Professional-quality gate for a homepage mockup. Returns the problems to fix (empty = pass). */
export function checkMockup(html: string): string[] {
  const issues: string[] = [];
  const kb = Buffer.byteLength(html) / 1024;
  if (!/^\s*<!doctype html>/i.test(html)) issues.push("must start with <!doctype html>");
  if (!/<meta[^>]+name=["']viewport["'][^>]+width=device-width/i.test(html)) issues.push("missing responsive viewport meta");
  if (!/<html[^>]+lang=["'][a-z-]+["']/i.test(html)) issues.push("<html> needs lang");
  if (/[؀-ۿ]/.test(html) && !/dir=["']rtl["']/i.test(html)) issues.push("Arabic content needs dir=\"rtl\" (or dir on the Arabic sections)");
  if (!/<title>[^<]{5,}<\/title>/i.test(html)) issues.push("needs a real <title>");
  if (!/<main\b/i.test(html)) issues.push("use semantic <main> (plus header/footer/section)");
  if ((html.match(/<h1\b/gi) ?? []).length !== 1) issues.push("exactly one <h1>");
  if ((html.match(/<section\b/gi) ?? []).length < 4) issues.push("at least 4 <section>s (hero, services, trust, contact…)");
  if (!/wa\.me\/|tel:/i.test(html)) issues.push("primary CTA must be a real wa.me/ or tel: link");
  if (!/@media|clamp\(|min\(|grid-template-columns:\s*repeat\(auto-fit/i.test(html)) issues.push("layout must be responsive (@media / clamp / auto-fit grid)");
  if (/<script\b/i.test(html) || /\son[a-z]+\s*=/i.test(html)) issues.push("no JavaScript or inline event handlers");
  if (/<img\b[^>]*src=["'](?!data:)/i.test(html) || /url\(\s*["']?https?:/i.test(html)) issues.push("no external images: use inline SVG, CSS or data: URIs");
  if (/<(link|script)\b[^>]*(href|src)=["']https?:\/\/(?!fonts\.googleapis\.com|fonts\.gstatic\.com)/i.test(html)) issues.push("only Google Fonts may be loaded from outside");
  if ((html.match(/<img\b/gi) ?? []).some((t: string) => !/\balt=/i.test(t))) issues.push("every <img> needs alt");
  if (kb > 120) issues.push(`too heavy (${Math.round(kb)} KB > 120 KB)`);
  if (kb < 4) issues.push("too thin to be a real homepage");
  return issues;
}

/** The fixed banner the preview always shows, so a concept is never mistaken for the business's official site. */
export function withConceptBanner(html: string, studio: string, lang: "ar" | "en" = "ar") {
  const text = lang === "ar" ? `تصوّر مقترح من ${studio} — مش الموقع الرسمي` : `Concept by ${studio} — not the official website`;
  const bar = `<div style="position:sticky;top:0;z-index:2147483647;background:#111;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center;padding:8px 12px">${text.replace(/</g, "&lt;")}</div>`;
  return /<body[^>]*>/i.test(html) ? html.replace(/<body([^>]*)>/i, `<body$1>${bar}`) : bar + html;
}
