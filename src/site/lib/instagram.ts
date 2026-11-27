// Latest posts from an event's own Instagram account, fetched on the server and refreshed hourly.
//
// Two ways to connect an account (set up one per event, Raipur and Raigarh are separate):
//  1. Behold.so (easiest, no expiry): create a free feed for the account and put its JSON link in
//     the event content file as `instagram.feedUrl`.
//  2. Instagram API (official): put a long-lived access token for the account in .env.local as
//     INSTAGRAM_TOKEN_RAIPUR / INSTAGRAM_TOKEN_RAIGARH (never in the code). Tokens last 60 days;
//     this file refreshes it automatically each time it's used, but if the site isn't visited for
//     60 days a new token must be generated.
// With neither set, the site keeps showing the "Follow on Instagram" card only.

import type { EventConfig } from "@/site/content/types";

export type IgPost = {
  id: string;
  permalink: string;
  image: string;
  isVideo: boolean;
  caption: string;
};

const REVALIDATE = 3600; // seconds
const LIMIT = 9;

type BeholdPost = {
  id: string;
  permalink: string;
  mediaType?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  sizes?: { medium?: { mediaUrl?: string }; small?: { mediaUrl?: string } };
  prunedCaption?: string;
  caption?: string;
};

async function fromBehold(url: string): Promise<IgPost[]> {
  const res = await fetch(url, { next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`Behold ${res.status}`);
  const data = (await res.json()) as { posts?: BeholdPost[] } | BeholdPost[];
  const posts = Array.isArray(data) ? data : (data.posts ?? []);
  return posts.map((p) => ({
    id: p.id,
    permalink: p.permalink,
    image: p.sizes?.medium?.mediaUrl ?? p.thumbnailUrl ?? p.mediaUrl ?? "",
    isVideo: p.mediaType === "VIDEO",
    caption: p.prunedCaption ?? p.caption ?? "",
  }));
}

type GraphPost = {
  id: string;
  permalink: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
};

async function fromGraph(token: string): Promise<IgPost[]> {
  // Keep the long-lived token alive (Instagram allows refreshing once it's 24h+ old; errors are harmless)
  fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`, {
    next: { revalidate: 86400 * 7 },
  }).catch(() => {});
  const fields = "id,permalink,media_type,media_url,thumbnail_url,caption";
  const res = await fetch(`https://graph.instagram.com/me/media?fields=${fields}&limit=${LIMIT}&access_token=${token}`, {
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`Instagram API ${res.status}`);
  const data = (await res.json()) as { data?: GraphPost[] };
  return (data.data ?? []).map((p) => ({
    id: p.id,
    permalink: p.permalink,
    image: (p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url) ?? "",
    isVideo: p.media_type === "VIDEO",
    caption: p.caption ?? "",
  }));
}

export async function getInstagramFeed(e: EventConfig): Promise<IgPost[]> {
  const feedUrl = e.instagram?.feedUrl;
  const token = process.env[`INSTAGRAM_TOKEN_${e.slug.toUpperCase()}`];
  try {
    const posts = feedUrl ? await fromBehold(feedUrl) : token ? await fromGraph(token) : [];
    return posts.filter((p) => p.image && p.permalink).slice(0, LIMIT);
  } catch (err) {
    console.warn(`[instagram] ${e.slug}: feed unavailable`, err);
    return []; // never break the page; the Follow card still shows
  }
}
