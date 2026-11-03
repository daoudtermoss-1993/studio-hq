import { env } from "./env";

export interface YouTubeFind {
  platform: "youtube";
  url: string;
  title: string;
  creator: string;
  views: number;
  likes: number | null;
  comments: number | null;
  creatorFollowers: number | null;
  publishedAt: Date;
  velocity: number;
  outlier: number | null;
  description: string;
}

const API = "https://www.googleapis.com/youtube/v3";

async function get(path: string, params: Record<string, string>) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY ?? "");
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`YouTube API ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<any>;
}

export const youtubeEnabled = () => Boolean(process.env.YOUTUBE_API_KEY) || env.aiProvider === "mock";

/**
 * Official YouTube Data API v3: recent short videos for each query, ranked by velocity × outlier.
 * Quota: search.list = 100 units per query, videos/channels.list = 1 unit (default daily quota 10,000).
 */
export async function youtubeViral(
  queries: string[],
  opts: { regionCode?: string; language?: string; days?: number; perQuery?: number } = {},
): Promise<YouTubeFind[]> {
  if (env.aiProvider === "mock" && !process.env.YOUTUBE_API_KEY) return mockFinds();
  if (!process.env.YOUTUBE_API_KEY || !queries.length) return [];
  const publishedAfter = new Date(Date.now() - (opts.days ?? 7) * 86_400_000).toISOString();
  const ids = new Set<string>();
  for (const q of queries.slice(0, 4)) {
    const r = await get("search", {
      part: "id", type: "video", q, order: "viewCount", videoDuration: "short", publishedAfter,
      maxResults: String(opts.perQuery ?? 15),
      ...(opts.regionCode ? { regionCode: opts.regionCode } : {}),
      ...(opts.language ? { relevanceLanguage: opts.language } : {}),
    });
    for (const it of r.items ?? []) if (it.id?.videoId) ids.add(it.id.videoId);
  }
  if (!ids.size) return [];
  const vids = await get("videos", { part: "snippet,statistics", id: [...ids].slice(0, 50).join(",") });
  const channelIds = [...new Set((vids.items ?? []).map((v: any) => v.snippet.channelId))].slice(0, 50) as string[];
  const chans = channelIds.length ? await get("channels", { part: "statistics", id: channelIds.join(",") }) : { items: [] };
  const subs = new Map<string, number | null>(
    (chans.items ?? []).map((c: any) => [c.id, c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount)]),
  );
  const now = Date.now();
  return (vids.items ?? [])
    .map((v: any): YouTubeFind => {
      const views = Number(v.statistics.viewCount ?? 0);
      const publishedAt = new Date(v.snippet.publishedAt);
      const hours = Math.max(1, (now - +publishedAt) / 3_600_000);
      const followers = subs.get(v.snippet.channelId) ?? null;
      return {
        platform: "youtube",
        url: `https://www.youtube.com/shorts/${v.id}`,
        title: v.snippet.title,
        creator: v.snippet.channelTitle,
        views,
        likes: v.statistics.likeCount ? Number(v.statistics.likeCount) : null,
        comments: v.statistics.commentCount ? Number(v.statistics.commentCount) : null,
        creatorFollowers: followers,
        publishedAt,
        velocity: Math.round(views / hours),
        outlier: followers ? Math.round(views / Math.max(1000, followers)) : null,
        description: String(v.snippet.description ?? "").slice(0, 500),
      };
    })
    .sort((a: YouTubeFind, b: YouTubeFind) => b.velocity * (b.outlier ?? 1) - a.velocity * (a.outlier ?? 1))
    .slice(0, 10);
}

function mockFinds(): YouTubeFind[] {
  const now = Date.now();
  return [1, 2, 3].map((i) => ({
    platform: "youtube" as const,
    url: `https://www.youtube.com/shorts/mock${i}${Math.floor(now / 86_400_000)}`,
    title: ["This AI does my job", "Stop using ChatGPT like this", "5 seconds rule for hooks"][i - 1],
    creator: `Creator ${i}`,
    views: 500_000 * i,
    likes: 20_000 * i,
    comments: 800 * i,
    creatorFollowers: 40_000,
    publishedAt: new Date(now - i * 86_400_000),
    velocity: Math.round((500_000 * i) / (i * 24)),
    outlier: Math.round((500_000 * i) / 40_000),
    description: "mock",
  }));
}
