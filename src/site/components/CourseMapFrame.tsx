"use client";

import { useEffect, useRef, useState } from "react";

// Shows the interactive course map (a static mini-site in /public) inside the page.
// The map reports its own height, so the page has one scrollbar, and the selected race,
// so the address can be shared (e.g. /raipur/course-map#21k opens the Half Marathon).
export default function CourseMapFrame({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [height, setHeight] = useState(1400);

  // Build the iframe address on the client so the race in the page's #hash is passed through
  useEffect(() => {
    setUrl(`${src}?embed=1${window.location.hash}`);
  }, [src]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin || ev.source !== ref.current?.contentWindow) return;
      const d = ev.data as { type?: string; height?: number; id?: string };
      if (d?.type === "course-map-height" && typeof d.height === "number" && d.height > 200) setHeight(d.height);
      if (d?.type === "course-map-race" && typeof d.id === "string" && /^[\w-]+$/.test(d.id)) {
        history.replaceState(null, "", `#${d.id}`);
      }
    };
    // Race links on the same page (e.g. a header link to #42k) switch the map's race
    const onHash = () => {
      const w = ref.current?.contentWindow;
      if (w && window.location.hash) w.location.hash = window.location.hash;
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  return (
    <div className="course-map-frame" style={{ height }}>
      {url && <iframe ref={ref} src={url} title={title} allow="fullscreen" allowFullScreen />}
    </div>
  );
}
