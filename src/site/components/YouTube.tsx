"use client";

import { useState } from "react";

// Shows a thumbnail first and loads the YouTube player only when tapped (saves data, faster pages).
export default function YouTube({ id, title, vertical = false }: { id: string; title: string; vertical?: boolean }) {
  const [play, setPlay] = useState(false);

  return (
    <div className={`video ${vertical ? "video-vertical" : ""}`}>
      {play ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" className="video-poster" onClick={() => setPlay(true)} aria-label={`Play video: ${title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Vertical videos use YouTube's portrait thumbnail (oardefault) so the poster isn't a cropped landscape image;
              falls back to the normal thumbnail if a video has none. */}
          <img
            src={`https://i.ytimg.com/vi/${id}/${vertical ? "oardefault" : "hqdefault"}.jpg`}
            onError={(ev) => {
              const img = ev.currentTarget;
              if (!img.src.includes("hqdefault")) img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
            }}
            alt=""
            loading="lazy"
            decoding="async"
          />
          <span className="video-play" aria-hidden="true">
            <svg viewBox="0 0 68 48" width="68" height="48">
              <path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.2.3 34 .3 34 .3s-21.2 0-26.5 1.4a8.5 8.5 0 0 0-6 6C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6c5.3 1.4 26.5 1.4 26.5 1.4s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3Z" fill="#e31e24" />
              <path d="M27 34.2 44.7 24 27 13.8z" fill="#fff" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
