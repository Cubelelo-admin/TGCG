"use client";

import { useEffect, useRef, useState } from "react";

// Embeds an external registration app; it posts { type: "tgcg:resize", height } to size the frame.
// Until it does, the frame fills most of the screen and a skeleton shows while it loads.
export default function RegisterFrame({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const origin = new URL(src).origin;
    function onMessage(e: MessageEvent) {
      if (e.origin !== origin || e.data?.type !== "tgcg:resize") return;
      if (ref.current && typeof e.data.height === "number") {
        ref.current.style.height = `${Math.max(400, e.data.height)}px`;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [src]);

  return (
    <div className={`register-wrap ${loaded ? "is-loaded" : ""}`}>
      {!loaded && (
        <div className="register-skeleton" aria-hidden="true">
          <span className="sk sk-title" />
          <span className="sk" />
          <span className="sk" />
          <span className="sk sk-short" />
          <span className="sk" />
          <span className="sk sk-btn" />
          <p className="sk-text">Loading the registration form…</p>
        </div>
      )}
      <iframe ref={ref} src={src} title={title} className="register-frame" onLoad={() => setLoaded(true)} />
    </div>
  );
}
