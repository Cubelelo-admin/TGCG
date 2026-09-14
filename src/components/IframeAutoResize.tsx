"use client";

import { useEffect } from "react";

const MESSAGE_TYPE = "tgcg:resize";

/**
 * Reports this page's content height to the parent window whenever it
 * changes, so an embedding <iframe> (e.g. on the tgcg.run homepage) can
 * resize itself instead of showing a scrollbar or clipping content.
 * No-ops when the page isn't actually embedded.
 */
export default function IframeAutoResize() {
  useEffect(() => {
    if (typeof window === "undefined" || window.self === window.top) return;

    let lastHeight = 0;
    const postHeight = () => {
      const height = document.documentElement.scrollHeight;
      if (height !== lastHeight) {
        lastHeight = height;
        window.parent.postMessage({ type: MESSAGE_TYPE, height }, "*");
      }
    };

    postHeight();

    const observer = new ResizeObserver(() => postHeight());
    observer.observe(document.documentElement);

    window.addEventListener("load", postHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("load", postHeight);
    };
  }, []);

  return null;
}
