"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/*
 * Reads QR codes (passes, pigeonhole and bin labels) and 1D barcodes (BIBs) from the phone camera
 * into a <video>. Shared by the full-screen CameraScanner (desk, handover, restock and the other
 * scan fields) and the picker's inline TaskCamera. Uses the browser's built-in BarcodeDetector
 * where it exists (Android Chrome) and otherwise the barcode-detector ponyfill (zxing
 * WebAssembly), which is what iPhones need. The .wasm file is served from /vendor (no CDN), named
 * by its version so a library upgrade that forgets to copy it fails loudly instead of loading a
 * mismatched file.
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
  // A failed load (e.g. offline) may be retried next time a camera opens.
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

/**
 * Starts the back camera into `videoRef` and calls `onDetect` with each new code. The next frame
 * is read only after onDetect's promise settles, so a slow scan never overlaps the next one.
 * `once`: stop reading after the first code. `onError`: the camera couldn't start (the message
 * says why, in words for the volunteer). The camera stops on unmount, even while still starting.
 */
export function useBarcodeCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  onDetect: (value: string) => void | Promise<void>,
  { once = false, onError }: { once?: boolean; onError?: (message: string) => void } = {}
): { starting: boolean; error: string | null } {
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onDetectRef = useRef(onDetect);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onDetectRef.current = onDetect;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const seen = new Map<string, number>();
    const stopStream = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no media"), { name: "NotFoundError" });
        // The detector loads while the camera starts.
        const detectorReady = getDetector();
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        // Kept the moment it arrives, so it can always be stopped. Closed while the camera was still
        // starting: stop it now, or the camera stays on (the old leak).
        stream = s;
        if (stopped) {
          stopStream();
          return;
        }
        const detector = await detectorReady;
        const video = videoRef.current;
        if (stopped || !video) {
          stopStream();
          return;
        }
        video.srcObject = s;
        await video.play();
        if (stopped) return;
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
                await onDetectRef.current(value);
                if (once) return;
              }
            }
          } catch {
            // A frame that can't be read is skipped.
          }
          if (!stopped) timer = setTimeout(tick, 120);
        };
        void tick();
      } catch (e) {
        stopStream();
        if (!stopped) {
          const message = cameraError(e);
          setStarting(false);
          setError(message);
          onErrorRef.current?.(message);
        }
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stopStream();
    };
  }, [videoRef, once]);

  return { starting, error };
}
