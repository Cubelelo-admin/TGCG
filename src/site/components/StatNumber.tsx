"use client";

import { useEffect, useRef, useState } from "react";
import type { Stat } from "@/site/content/types";

const fmt = (n: number, plain?: boolean) => (plain ? String(n) : n.toLocaleString("en-IN"));

// Counts up from 0 when scrolled into view. Server render shows the final value (no JS / reduced motion).
export default function StatNumber({ stat }: { stat: Stat }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(stat.value);

  useEffect(() => {
    const el = ref.current;
    if (!el || stat.plain || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    let raf = 0;
    setShown(0);
    const io = new IntersectionObserver(
      ([en]) => {
        if (!en.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 1400;
        const step = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          setShown(Math.round(stat.value * eased));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [stat.value, stat.plain]);

  return (
    <span ref={ref} className="stat-num">
      <span aria-hidden="true">
        {stat.prefix}
        {fmt(shown, stat.plain)}
        {stat.suffix}
      </span>
      <span className="sr-only">
        {stat.prefix}
        {fmt(stat.value, stat.plain)}
        {stat.suffix}
      </span>
    </span>
  );
}
