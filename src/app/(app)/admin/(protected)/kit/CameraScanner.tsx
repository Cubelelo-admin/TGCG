"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/ds";
import { useBarcodeCamera } from "./useBarcodeCamera";

/*
 * Full-screen phone-camera scanner: reads one code, hands it to the screen, then closes. Opened by
 * the camera button of a scan field (ScanInput). The detection lives in useBarcodeCamera, shared
 * with the picker's inline task camera.
 */

export default function CameraScanner({
  title,
  onDetect,
  onClose,
}: {
  title: string;
  /** Called with the code read. The scanner closes once it has finished. */
  onDetect: (value: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [last, setLast] = useState<string | null>(null);
  const { starting, error } = useBarcodeCamera(
    videoRef,
    async (value) => {
      setLast(value);
      await onDetect(value);
      onClose();
    },
    { once: true }
  );
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[300] flex flex-col bg-black">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <p className="min-w-0 truncate text-16 font-semibold">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <Icon name="close" size={22} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[58vmin] w-[78vmin] max-w-[420px] rounded-12 border-4 border-white/90 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
          </div>
        )}
        {starting && !error && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-16 text-white">Starting camera…</p>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <Icon name="warning" size={32} className="text-[#FDB022]" />
            <p className="max-w-sm text-16 text-white">{error}</p>
            <Button variant="outline" onClick={onClose} className="h-12! px-6!">
              Type it instead
            </Button>
          </div>
        )}
      </div>

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center text-white">
        {last ? (
          <p className="text-14">
            Scanned <span className="font-mono font-semibold">{last}</span>
          </p>
        ) : (
          <p className="text-14 text-white/80">Hold the code inside the frame</p>
        )}
      </div>
    </div>
  );
}
