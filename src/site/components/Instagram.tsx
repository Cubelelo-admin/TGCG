"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

const SCRIPT = "https://www.instagram.com/embed.js";

export const InstagramIcon = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

// Embeds chosen Instagram posts / reels. The embed script loads only when the section nears the screen.
export function InstagramPosts({ posts }: { posts: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !posts.length) return;
    const load = () => {
      if (window.instgrm) return window.instgrm.Embeds.process();
      if (document.querySelector(`script[src="${SCRIPT}"]`)) return;
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      document.body.appendChild(s);
    };
    const io = new IntersectionObserver(
      ([en]) => {
        if (en.isIntersecting) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [posts]);

  if (!posts.length) return null;

  return (
    <div ref={ref} className="ig-posts">
      {posts.map((url) => (
        <blockquote key={url} className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14">
          <a href={url} target="_blank" rel="noopener noreferrer">
            View this post on Instagram
          </a>
        </blockquote>
      ))}
    </div>
  );
}
