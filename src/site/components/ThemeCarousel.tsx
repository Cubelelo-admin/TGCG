"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

// Swipeable carousel. Tap a slide to view it full screen.
//   variant "poster" (default): 4:5 theme slides, 3 per view on desktop, 1 on phones, dots.
//   variant "photo": 3:2 race photos, 2 per view on desktop, 1 on phones, "n / total" counter + progress bar.
export default function ThemeCarousel({
  images,
  title,
  variant = "poster",
}: {
  images: string[];
  title: string;
  variant?: "poster" | "photo";
}) {
  const photo = variant === "photo";
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [view, setView] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const n = images.length;

  // Which slide is in view (left-most fully visible)
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const slide = el.firstElementChild as HTMLElement | null;
      if (!slide) return;
      const step = slide.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
      // At the far end (several slides in view) count the last slide as active, so the counter reaches n
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      setActive(atEnd ? n - 1 : Math.min(n - 1, Math.round(el.scrollLeft / step)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [n]);

  const scrollTo = (i: number) => {
    const el = track.current;
    const slide = el?.children[Math.max(0, Math.min(n - 1, i))] as HTMLElement | undefined;
    if (el && slide) el.scrollTo({ left: slide.offsetLeft, behavior: "smooth" }); // track is position:relative
  };

  // Full-screen reader
  const close = useCallback(() => setView(null), []);
  const go = useCallback((d: number) => setView((i) => (i === null ? i : (i + d + n) % n)), [n]);
  useEffect(() => {
    if (view === null) return;
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
  }, [view, close, go]);

  return (
    <div className={`theme-carousel ${photo ? "tc-photo" : ""}`}>
      <div className="tc-track" ref={track}>
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            className="tc-slide"
            onClick={() => setView(i)}
            aria-label={`${title}: ${photo ? "photo" : "slide"} ${i + 1} of ${n}. Tap to view full screen`}
          >
            <Image
              src={src}
              alt={`${title}, ${photo ? "photo" : "slide"} ${i + 1}`}
              width={1080}
              height={photo ? 720 : 1350}
              sizes={photo ? "(max-width: 700px) 88vw, 48vw" : "(max-width: 700px) 85vw, 32vw"}
            />
          </button>
        ))}
      </div>

      <div className="tc-controls">
        <button type="button" className="tc-arrow" onClick={() => scrollTo(active - 1)} disabled={active === 0} aria-label="Previous">
          ‹
        </button>
        {photo ? (
          <div className="tc-progress" aria-live="polite">
            <span className="tc-count">
              <strong>{active + 1}</strong> / {n}
            </span>
            <span className="tc-bar" aria-hidden="true">
              <i style={{ width: `${((active + 1) / n) * 100}%` }} />
            </span>
          </div>
        ) : (
          <div className="tc-dots" role="tablist" aria-label="Theme slides">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Slide ${i + 1}`}
                className={i === active ? "on" : ""}
                onClick={() => scrollTo(i)}
              />
            ))}
          </div>
        )}
        <button type="button" className="tc-arrow" onClick={() => scrollTo(active + 1)} disabled={active >= n - 1} aria-label="Next slide">
          ›
        </button>
      </div>

      {view !== null && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${title}, slide ${view + 1} of ${n}`}
          onClick={(ev) => ev.target === ev.currentTarget && close()}
          onTouchStart={(ev) => (touchX.current = ev.touches[0].clientX)}
          onTouchEnd={(ev) => {
            if (touchX.current === null) return;
            const dx = ev.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <button type="button" className="lb-btn lb-close" onClick={close} aria-label="Close" autoFocus>
            ✕
          </button>
          <button type="button" className="lb-btn lb-prev" onClick={() => go(-1)} aria-label="Previous slide">
            ‹
          </button>
          <figure className="lb-figure">
            <Image key={images[view]} src={images[view]} alt={`${title}, slide ${view + 1}`} fill sizes="100vw" className="lb-img" priority />
          </figure>
          <button type="button" className="lb-btn lb-next" onClick={() => go(1)} aria-label="Next slide">
            ›
          </button>
          <p className="lb-count">
            {view + 1} / {n}
          </p>
        </div>
      )}
    </div>
  );
}
