"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Fades `.reveal` elements in as they scroll into view. Content stays visible without JS
// (the hidden state only applies once `html.reveal-ready` is set) and for reduced-motion users (CSS).
export default function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (!("IntersectionObserver" in window)) return;
    root.classList.add("reveal-ready");

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add("is-visible");
            io.unobserve(en.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    const scan = () => document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => io.observe(el));
    scan();
    // Pick up content rendered later (e.g. after client navigation), at most every 250ms
    let timer: ReturnType<typeof setTimeout> | null = null;
    const mo = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        scan();
      }, 250);
    });
    mo.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
