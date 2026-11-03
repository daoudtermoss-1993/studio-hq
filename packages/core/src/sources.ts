import { env } from "./env";

/** A public post where someone asks for help. */
export interface ProblemPost {
  source: "reddit" | "stackexchange" | "hn" | "github";
  url: string;
  title: string;
  body: string;
  author: string;
  contact: string;
  postedAt: Date | null;
  votes: number | null;
}

const UA = "studio-hq/0.1 (problem research)";
const strip = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

async function getJson(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json() as Promise<any>;
}

/** Stack Exchange API (keyless quota ~300/day per IP; STACKEXCHANGE_KEY raises it). `where` = site, e.g. networkengineering. */
export async function searchStackExchange(q: string, site = "stackoverflow"): Promise<ProblemPost[]> {
  const u = new URL("https://api.stackexchange.com/2.3/search/advanced");
  Object.entries({ order: "desc", sort: "creation", q, site, filter: "withbody", pagesize: "10", answers: "0" }).forEach(([k, v]) => u.searchParams.set(k, v));
  if (process.env.STACKEXCHANGE_KEY) u.searchParams.set("key", process.env.STACKEXCHANGE_KEY);
  const r = await getJson(u.toString());
  return (r.items ?? []).map((i: any) => ({
    source: "stackexchange" as const, url: i.link, title: strip(i.title ?? ""), body: strip(i.body ?? "").slice(0, 1500),
    author: i.owner?.display_name ?? "", contact: i.owner?.link ?? "", postedAt: i.creation_date ? new Date(i.creation_date * 1000) : null, votes: i.score ?? null,
  }));
}

/** Hacker News via the public Algolia API (Ask HN and stories). */
export async function searchHackerNews(q: string): Promise<ProblemPost[]> {
  const r = await getJson(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=(ask_hn,story)&hitsPerPage=10`);
  return (r.hits ?? []).map((h: any) => ({
    source: "hn" as const, url: `https://news.ycombinator.com/item?id=${h.objectID}`, title: h.title ?? "", body: strip(h.story_text ?? "").slice(0, 1500),
    author: h.author ?? "", contact: h.author ? `https://news.ycombinator.com/user?id=${h.author}` : "", postedAt: h.created_at ? new Date(h.created_at) : null, votes: h.points ?? null,
  }));
}

/** GitHub issue search (unauthenticated: 10 req/min; GITHUB_TOKEN raises limits). */
export async function searchGitHub(q: string): Promise<ProblemPost[]> {
  const r = await getJson(`https://api.github.com/search/issues?q=${encodeURIComponent(`${q} is:issue is:open`)}&sort=created&order=desc&per_page=10`, {
    headers: { Accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
  });
  return (r.items ?? []).map((i: any) => ({
    source: "github" as const, url: i.html_url, title: i.title ?? "", body: String(i.body ?? "").slice(0, 1500),
    author: i.user?.login ?? "", contact: i.user?.html_url ?? "", postedAt: i.created_at ? new Date(i.created_at) : null, votes: i.reactions?.total_count ?? null,
  }));
}

let redditToken: { value: string; until: number } | null = null;
async function reddit() {
  if (redditToken && redditToken.until > Date.now()) return redditToken.value;
  const basic = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64");
  const r = await getJson("https://www.reddit.com/api/v1/access_token", {
    method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials",
  });
  redditToken = { value: r.access_token, until: Date.now() + (r.expires_in - 60) * 1000 };
  return redditToken.value;
}

/** Reddit Data API (needs a free "script" app: REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET). `where` = subreddit. */
export async function searchReddit(q: string, subreddit = "smallbusiness"): Promise<ProblemPost[]> {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) return [];
  const token = await reddit();
  const sub = subreddit.replace(/^r\//, "").replace(/[^A-Za-z0-9_]/g, "") || "smallbusiness";
  const r = await getJson(`https://oauth.reddit.com/r/${sub}/search?q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&t=month&limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (r.data?.children ?? []).map(({ data: d }: any) => ({
    source: "reddit" as const, url: `https://www.reddit.com${d.permalink}`, title: d.title ?? "", body: String(d.selftext ?? "").slice(0, 1500),
    author: d.author ?? "", contact: d.author ? `https://www.reddit.com/user/${d.author}` : "", postedAt: d.created_utc ? new Date(d.created_utc * 1000) : null, votes: d.score ?? null,
  }));
}

export async function searchSource(source: ProblemPost["source"], q: string, where = ""): Promise<ProblemPost[]> {
  if (env.aiProvider === "mock") return mockPosts(source, q);
  if (source === "stackexchange") return searchStackExchange(q, where || "stackoverflow");
  if (source === "hn") return searchHackerNews(q);
  if (source === "github") return searchGitHub(q);
  return searchReddit(q, where || "smallbusiness");
}

function mockPosts(source: ProblemPost["source"], q: string): ProblemPost[] {
  const day = Math.floor(Date.now() / 86_400_000);
  return [1, 2].map((i) => ({
    source, url: `https://example.com/${source}/${day}-${encodeURIComponent(q).slice(0, 20)}-${i}`,
    title: source === "stackexchange"
      ? ["NSO service fails on re-deploy after device sync-from", "YANG model validation error when committing a NETCONF edit"][i - 1]
      : ["Clinic loses bookings because nobody answers WhatsApp at night", "Small shop spends hours copying invoices into Excel"][i - 1],
    body: "Looking for a way to fix this, tried a few things, nothing works.", author: `user${i}`, contact: "",
    postedAt: new Date(Date.now() - i * 86_400_000), votes: 5 * i,
  }));
}
