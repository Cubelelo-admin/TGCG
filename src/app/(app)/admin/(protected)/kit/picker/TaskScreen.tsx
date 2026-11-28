"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button, Icon, StatusPill } from "@/components/ds";
import type { PickerBin, PickerTask } from "@/lib/expo";
import { ResultBanner, isTouchFirst, type Alert } from "../ScanInput";
import TaskCamera from "./TaskCamera";
import { cameraLine, currentStep, progress, takeWhat, taskSteps, type Step } from "./steps";

// "Camera off" is remembered on this phone (localStorage), read through useSyncExternalStore.
const CAMERA_KEY = "tgcg.picker.camera";
const CAMERA_EVENT = "tgcg-picker-camera";
function subscribeCamera(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CAMERA_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CAMERA_EVENT, onChange);
  };
}
const readCameraOff = () => window.localStorage.getItem(CAMERA_KEY) === "off";
function saveCameraOff(off: boolean) {
  if (off) window.localStorage.setItem(CAMERA_KEY, "off");
  else window.localStorage.removeItem(CAMERA_KEY);
  window.dispatchEvent(new Event(CAMERA_EVENT));
}

/**
 * The picker's screen during an accepted task (docs/volunteer-assignments-design.md §4.1). Top,
 * over half the screen: the live camera with what to scan now, and under it a box to type a code
 * (it also takes a hardware scanner). Below: one step at a time, then a progress bar pinned to the
 * bottom. Every scan (camera, typed or hardware) goes to onScan: one server action per scan.
 */
export default function TaskScreen({
  task,
  alert,
  note,
  onDismissNote,
  connError,
  busy,
  onScan,
  onBinEmpty,
  onGiveBack,
}: {
  task: PickerTask;
  /** The last scan's result (or another action's): over the camera's bottom edge. */
  alert: Alert | null;
  /** An assignment change (0033), until dismissed. */
  note: Alert | null;
  onDismissNote: () => void;
  connError: boolean;
  busy: boolean;
  /** Sends one scan. Resolves true when it moved the task on (a green answer). */
  onScan: (code: string) => Promise<boolean>;
  onBinEmpty: (bin: PickerBin) => void;
  onGiveBack: () => void;
}) {
  const cameraOff = useSyncExternalStore(subscribeCamera, readCameraOff, () => true);
  // Why the camera couldn't start (blocked, missing, not https), shown in its place.
  const [problem, setProblem] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  // Codes that already did their job in this task (a bin or BIB picked). The camera keeps seeing a
  // label after it is scanned: those repeats are dropped instead of showing "already picked".
  const usedCodes = useRef(new Set<string>());

  // A laptop with a hardware scanner types straight into the box. (On a phone, focusing it would
  // pop the keyboard up.)
  useEffect(() => {
    if (!isTouchFirst()) inputRef.current?.focus();
  }, []);

  const steps = taskSteps(task);
  const step = currentStep(steps);
  const p = progress(task, steps);
  const showCamera = !cameraOff && problem === null;

  async function scan(raw: string, fromCamera: boolean) {
    const value = raw.trim().toUpperCase();
    if (!value || (fromCamera && usedCodes.current.has(value))) return;
    if (await onScan(value)) usedCodes.current.add(value);
  }

  return (
    <div className="flex flex-col gap-3">
      <section>
        {showCamera ? (
          <TaskCamera
            line={cameraLine(task, step)}
            alert={alert}
            onScan={(v) => scan(v, true)}
            onOff={() => saveCameraOff(true)}
            onError={setProblem}
          />
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-12 bg-surface-tertiary px-3 py-2.5">
            <p className="min-w-0 text-14 font-medium text-ink-tertiary">{problem ?? "Camera off: type the code below"}</p>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => {
                setProblem(null);
                saveCameraOff(false);
              }}
            >
              Turn camera on
            </Button>
          </div>
        )}
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const typed = code;
            setCode("");
            void scan(typed, false).then(() => {
              if (!isTouchFirst()) inputRef.current?.focus();
            });
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Code
          </label>
          <input
            id={inputId}
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Camera can't read it? Type the code"
            className="h-12 min-w-0 flex-1 rounded-6 border border-line bg-white px-3 font-mono text-18 uppercase tracking-wide text-ink outline-hidden placeholder:font-sans placeholder:text-14 placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <Button type="submit" variant="dark" className="h-12! px-5!">
            Enter
          </Button>
        </form>
        {!showCamera && <ResultBanner banner={alert} className="mt-2" />}
      </section>

      <ResultBanner banner={note} onDismiss={onDismissNote} />
      {connError && (
        <p>
          <StatusPill tone="expired">Connection problem: retrying</StatusPill>
        </p>
      )}
      <StepCard task={task} step={step} busy={busy} onBinEmpty={onBinEmpty} onGiveBack={onGiveBack} />

      <div className="sticky bottom-0 z-10 -mx-3 border-t border-line-secondary bg-white px-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-2.5 text-14 text-ink-tertiary">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="font-semibold text-ink">{p.label}</span>
          <span>
            {p.picked} · {task.orderCode} → <span className="font-mono font-semibold text-ink">{task.crate ?? "—"}</span>
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Task progress"
          aria-valuemin={0}
          aria-valuemax={p.total}
          aria-valuenow={p.done}
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-tertiary"
        >
          <div
            className="h-full rounded-full bg-[#079455] transition-[width] duration-300"
            style={{ width: `${Math.round((p.done / p.total) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** One instruction in large type. When a scan finishes it, the next step replaces it. */
function StepCard({
  task,
  step,
  busy,
  onBinEmpty,
  onGiveBack,
}: {
  task: PickerTask;
  step: Step;
  busy: boolean;
  onBinEmpty: (bin: PickerBin) => void;
  onGiveBack: () => void;
}) {
  if (step.type === "drop") {
    return (
      <>
        <section className="rounded-12 bg-tint-green px-4 py-3.5 text-center">
          <p className="flex items-center justify-center gap-1 text-12 font-semibold uppercase tracking-wide text-on-tint-green">
            <Icon name="check" size={14} />
            All picked
          </p>
          <p className="mt-1.5 text-18 font-semibold text-ink">Drop everything in pigeonhole</p>
          {/* One exception to the Dock type scale: read at arm's length while carrying the items. */}
          <p className="my-1 break-all font-mono text-[56px] font-bold leading-[62px] text-on-tint-green">{task.crate ?? "—"}</p>
          <p className="text-14 text-ink-secondary">Then scan its label (or type it above) to finish.</p>
        </section>
        <Button onClick={onGiveBack} disabled={busy} className="h-11! w-full">
          Can&apos;t finish: give this task back
        </Button>
      </>
    );
  }

  const bin = step.bin;
  return (
    <>
      <section className="rounded-12 border-2 border-dark bg-white px-4 py-3.5">
        {step.type === "take" && (
          <>
            <p className="text-14 font-semibold text-ink-tertiary">Take</p>
            <p className="text-32 font-bold text-ink">{takeWhat(task.kind, bin)}</p>
            <p className="mt-0.5 text-16 text-ink-secondary">
              from bin <span className="break-all font-mono text-24 font-bold text-ink">{bin.code}</span>
            </p>
            <p className="mt-2 text-14 text-ink-secondary">
              Then scan the bin label: that picks {bin.count - bin.picked === 1 ? "it" : "them"}.
            </p>
          </>
        )}
        {step.type === "open" && (
          <>
            <p className="text-14 font-semibold text-ink-tertiary">Go to bin</p>
            <p className="break-all font-mono text-32 font-bold text-ink">{bin.code}</p>
            <p className="mt-2 text-14 text-ink-secondary">Scan its label to open it.</p>
          </>
        )}
        {step.type === "bib" && (
          <>
            <p className="text-14 font-semibold text-ink-tertiary">Take BIB</p>
            <p className="font-mono text-32 font-bold text-ink">{step.line.bib ?? "?"}</p>
            <p className="mt-0.5 text-16 text-ink-secondary">
              from bin <span className="break-all font-mono text-24 font-bold text-ink">{bin.code}</span>
            </p>
            <p className="mt-2 text-14 text-ink-secondary">Then scan the BIB itself.</p>
          </>
        )}
        {bin.empty && (
          <ResultBanner
            className="mt-3"
            banner={{ tone: "warn", title: "Bin marked empty", text: "Restock is on the way. Wait here or give the task back." }}
          />
        )}
      </section>
      <div className="grid grid-cols-2 gap-2">
        {!bin.empty && (
          <Button onClick={() => onBinEmpty(bin)} disabled={busy} className="h-11! text-[#B42318]!">
            Bin is empty
          </Button>
        )}
        <Button onClick={onGiveBack} disabled={busy} className={`h-11! ${bin.empty ? "col-span-2" : ""}`}>
          Give task back
        </Button>
      </div>
    </>
  );
}
