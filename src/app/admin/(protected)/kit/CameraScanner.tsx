"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/ds";

/*
 * Full-screen phone-camera scanner for QR codes (passes, crate and bin labels) and 1D
 * barcodes (BIBs). Uses the browser's built-in BarcodeDetector where it exists (Android
 * Chrome) and otherwise the barcode-detector ponyfill (zxing WebAssembly), which is what
 * iPhones need. The .wasm file is served from /vendor (no CDN), named by its version so a
 * library upgrade that forgets to copy it fails loudly instead of loading a mismatched file.
 *
 * Cameras only work on HTTPS (or localhost): on a plain-http LAN address the error says so.
 */

const FORMATS = ["qr_code", "code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "itf"] as const;
/** The same code seen again within this window is ignored (the camera sees it many times a second). */
const REPEAT_MS = 2500;

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };

let detectorPromise: Promise<Detector> | null = null;

function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } })
      .BarcodeDetector;
    if (Native) {
      try {
        const supported = await Native.getSupportedFormats();
        if (supported.includes("qr_code")) {
          return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
        }
      } catch {
        // fall through to the ponyfill
      }
    }
    const { BarcodeDetector, prepareZXingModule, ZXING_WASM_VERSION } = await import("barcode-detector/ponyfill");
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? `/vendor/zxing_reader-${ZXING_WASM_VERSION}.wasm` : prefix + path,
      },
    });
    return new BarcodeDetector({ formats: [...FORMATS] }) as unknown as Detector;
  })();
  // A failed load (e.g. offline) may be retried next time the scanner opens.
  detectorPromise.catch(() => {
    detectorPromise = null;
  });
  return detectorPromise;
}

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (typeof window !== "undefined" && !window.isSecureContext) return "The camera only works on the https:// site.";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access is blocked. Allow the camera for this site in your browser settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this device.";
  if (name === "NotReadableError") return "The camera is in use by another app. Close it and try again.";
  return "Couldn't start the camera. Type the code instead.";
}

export default function CameraScanner({
  title,
  onDetect,
  onClose,
  continuous = false,
  feedback = null,
}: {
  title: string;
  /** Called with each new code. In single mode the scanner closes itself after the first. */
  onDetect: (value: string) => void | Promise<void>;
  onClose: () => void;
  /** Keep scanning after a hit (pickers scanning several BIBs). */
  continuous?: boolean;
  /** Result of the last scan (the screen's banner), shown over the camera in continuous mode. */
  feedback?: { ok: boolean; text: string } | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [last, setLast] = useState<string | null>(null);
  const onDetectRef = useRef(onDetect);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onDetectRef.current = onDetect;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const seen = new Map<string, number>();

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no media"), { name: "NotFoundError" });
        const [s, detector] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          }),
          getDetector(),
        ]);
        stream = s;
        if (stopped) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        await video.play();
        setStarting(false);

        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2) {
              const found = await detector.detect(video);
              const value = found.map((f) => f.rawValue.trim()).find(Boolean);
              const now = Date.now();
              if (value && now - (seen.get(value) ?? 0) > REPEAT_MS) {
                seen.set(value, now);
                navigator.vibrate?.(60);
                setLast(value);
                await onDetectRef.current(value);
                if (!continuous) {
                  onCloseRef.current();
                  return;
                }
              }
            }
          } catch {
            // A frame that can't be read is skipped.
          }
          timer = setTimeout(tick, 120);
        };
        void tick();
      } catch (e) {
        if (!stopped) {
          setStarting(false);
          setError(cameraError(e));
        }
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [continuous]);

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
        {continuous && feedback && last ? (
          <p
            role="status"
            className={`rounded-8 px-3 py-2 text-16 font-semibold ${feedback.ok ? "bg-[#079455] text-white" : "bg-[#D92D20] text-white"}`}
          >
            {feedback.text}
          </p>
        ) : last ? (
          <p className="text-14">
            Scanned <span className="font-mono font-semibold">{last}</span>
            {continuous ? " · keep scanning" : ""}
          </p>
        ) : (
          <p className="text-14 text-white/80">Hold the code inside the frame</p>
        )}
        {continuous && (
          <Button variant="outline" onClick={onClose} className="mt-3 h-12! w-full">
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
