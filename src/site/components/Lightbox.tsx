"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

// Photo grid + full-screen viewer with swipe, arrow keys and Escape.
export default function Lightbox({
  images,
  altPrefix,
  className = "gallery-grid",
  limit,
}: {
  images: string[];
  altPrefix: string;
  className?: string;
  limit?: number;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const touchX = useRef<number | null>(null);
  const n = images.length;
  const shown = limit ? images.slice(0, limit) : images;

  const open = (i: number) => {
    lastFocus.current = document.activeElement as HTMLElement;
    setIndex(i);
  };
  const close = useCallback(() => {
    setIndex(null);
    lastFocus.current?.focus();
  }, []);
  const go = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + n) % n)), [n]);

  useEffect(() => {
    if (index === null) return;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
      else if (ev.key === "ArrowRight") go(1);
      else if (ev.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, close, go]);

  return (
    <>
      <div className={className}>
        {shown.map((src, i) => (
          <button key={src} type="button" className="gallery-item" onClick={() => open(i)} aria-label={`Open photo ${i + 1} of ${n}`}>
            <Image src={src} alt={`${altPrefix} ${i + 1}`} width={540} height={540} sizes="(max-width: 700px) 50vw, 25vw" />
          </button>
        ))}
      </div>

      {index !== null && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${index + 1} of ${n}`}
          onClick={(ev) => ev.target === ev.currentTarget && close()}
          onTouchStart={(ev) => (touchX.current = ev.touches[0].clientX)}
          onTouchEnd={(ev) => {
            if (touchX.current === null) return;
            const dx = ev.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <button ref={closeRef} type="button" className="lb-btn lb-close" onClick={close} aria-label="Close">
            ✕
          </button>
          <button type="button" className="lb-btn lb-prev" onClick={() => go(-1)} aria-label="Previous photo">
            ‹
          </button>
          <figure className="lb-figure">
            <Image
              key={images[index]}
              src={images[index]}
              alt={`${altPrefix} ${index + 1}`}
              fill
              sizes="100vw"
              className="lb-img"
              priority
            />
          </figure>
          <button type="button" className="lb-btn lb-next" onClick={() => go(1)} aria-label="Next photo">
            ›
          </button>
          <p className="lb-count">
            {index + 1} / {n}
          </p>
        </div>
      )}
    </>
  );
}
