import Image from "next/image";
import type { EventConfig } from "@/site/content/types";
import { getInstagramFeed } from "@/site/lib/instagram";
import { InstagramIcon, InstagramPosts } from "./Instagram";

// Profile card for the event's own Instagram account, with its latest posts when a live feed is
// connected (see src/lib/instagram.ts). Without a feed: any posts listed in the content file, or photo tiles.
export default async function InstagramSection({ e, photos = [] }: { e: EventConfig; photos?: string[] }) {
  const ig = e.instagram;
  if (!ig) return null;
  const feed = await getInstagramFeed(e);
  const posts = feed.length ? [] : (ig.posts ?? []);
  const tiles = feed.length || posts.length ? [] : photos.slice(0, 6);

  return (
    <section className="section ig-section">
      <div className="container">
        <div className="ig-card reveal">
          <div className="ig-card-head">
            <span className="ig-avatar" aria-hidden="true">
              <InstagramIcon size={30} />
            </span>
            <div>
              <p className="eyebrow">{feed.length ? "Latest on Instagram" : "Follow on Instagram"}</p>
              <h2 className="ig-handle">{ig.handle}</h2>
              <p className="muted">
                Training tips, route reveals, race-day photos and reels from {e.shortName}.{" "}
                <span className="hi">हमें इंस्टाग्राम पर फ़ॉलो करें।</span>
              </p>
            </div>
            <a href={ig.url} target="_blank" rel="noopener noreferrer" className="btn btn-ig">
              <InstagramIcon size={18} /> Follow {ig.handle}
            </a>
          </div>

          {feed.length > 0 && (
            <ul className="ig-feed">
              {feed.map((p) => (
                <li key={p.id}>
                  <a href={p.permalink} target="_blank" rel="noopener noreferrer" title={p.caption.slice(0, 120)}>
                    {/* Instagram image links expire and change, so a plain img is used (not next/image) */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt={p.caption ? p.caption.slice(0, 100) : `Post by ${ig.handle}`} loading="lazy" />
                    {p.isVideo && (
                      <span className="ig-feed-badge" aria-label="Reel">
                        ▶
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {tiles.length > 0 && (
            <a href={ig.url} target="_blank" rel="noopener noreferrer" className="ig-tiles" aria-label={`Open ${ig.handle} on Instagram`}>
              {tiles.map((src) => (
                <span key={src} className="ig-tile">
                  <Image src={src} alt="" width={300} height={300} sizes="(max-width: 700px) 33vw, 16vw" />
                </span>
              ))}
            </a>
          )}
        </div>

        <InstagramPosts posts={posts} />
      </div>
    </section>
  );
}
