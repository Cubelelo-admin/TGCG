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
      // Not document.documentElement.scrollHeight: per spec, the root
      // element's scrollHeight is max(viewport height, content height) —
      // once the parent has grown the iframe to fit a tall form, that
      // "viewport height" IS the iframe's own (now large) rendered size,
      // so documentElement.scrollHeight can never measure smaller again
      // even after content shrinks back down (e.g. Save collapsing the
      // form to the "So Far" recap). document.body has no such clamping
      // and reports the real content height.
      const height = document.body.scrollHeight;
      if (height !== lastHeight) {
        lastHeight = height;
        window.parent.postMessage({ type: MESSAGE_TYPE, height }, "*");
      }
    };

    postHeight();

    const observer = new ResizeObserver(() => postHeight());
    observer.observe(document.body);

    window.addEventListener("load", postHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("load", postHeight);
    };
  }, []);

  return null;
}
