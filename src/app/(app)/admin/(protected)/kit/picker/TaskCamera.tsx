"use client";

import { useRef } from "react";
import { ResultBanner, type Alert } from "../ScanInput";
import { useBarcodeCamera } from "../useBarcodeCamera";

/**
 * The top of the picker's task screen: a live camera that keeps reading for the whole task. Across
 * its top edge: what to scan now. Over its bottom edge: the last scan's result, where the picker is
 * looking. "Camera off" folds it away (TaskScreen remembers the choice on this phone).
 */
export default function TaskCamera({
  line,
  alert,
  onScan,
  onOff,
  onError,
}: {
  line: string;
  alert: Alert | null;
  onScan: (code: string) => Promise<void>;
  onOff: () => void;
  /** The camera can't start (blocked, missing, not https): TaskScreen folds it away and says why. */
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { starting } = useBarcodeCamera(videoRef, onScan, { onError });

  return (
    <div className="relative h-[55dvh] overflow-hidden rounded-12 bg-black text-white">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[30dvh] max-h-[260px] w-[70%] max-w-[300px] rounded-12 border-4 border-white/90" />
      </div>
      {starting && <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-16">Starting camera…</p>}
      <div className="absolute inset-x-0 top-0 flex items-start gap-3 bg-black/60 px-3 py-2.5">
        <p className="min-w-0 flex-1 text-16 font-semibold">{line}</p>
        <button
          type="button"
          onClick={onOff}
          className="shrink-0 rounded-8 bg-white/20 px-2.5 py-1 text-12 font-medium hover:bg-white/30"
        >
          Camera off
        </button>
      </div>
      {alert && (
        <div className="absolute inset-x-2.5 bottom-2.5">
          <ResultBanner banner={alert} className="shadow-[0_6px_18px_rgba(0,0,0,0.4)]" />
        </div>
      )}
    </div>
  );
}
