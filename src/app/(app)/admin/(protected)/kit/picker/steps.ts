import type { ExpoKind, PickerBin, PickerLine, PickerTask } from "@/lib/expo";

/*
 * A picker's task as single steps (docs/volunteer-assignments-design.md §4.1). The task screen
 * shows only the first step not done yet. A scan that finishes a later step still counts, and that
 * step is skipped when its turn comes. T-shirts and packs: one step per bin (take, then scan the
 * bin label, which picks them). BIBs: open the bin, then one step per BIB. Last: the pigeonhole.
 */

export type Step =
  | { type: "take"; bin: PickerBin; done: boolean }
  | { type: "open"; bin: PickerBin; done: boolean }
  | { type: "bib"; bin: PickerBin; line: PickerLine; done: boolean }
  | { type: "drop"; done: false };

export function taskSteps(task: PickerTask): Step[] {
  const steps: Step[] = [];
  for (const bin of task.bins) {
    if (task.kind === "bib") {
      steps.push({ type: "open", bin, done: bin.opened });
      for (const line of bin.lines) steps.push({ type: "bib", bin, line, done: line.picked });
    } else {
      steps.push({ type: "take", bin, done: bin.picked === bin.count });
    }
  }
  steps.push({ type: "drop", done: false });
  return steps;
}

/** The step on screen: the first one not done (the pigeonhole, once everything is picked). */
export function currentStep(steps: Step[]): Step {
  return steps.find((s) => !s.done) ?? steps[steps.length - 1];
}

const NOUN: Record<ExpoKind, [string, string]> = {
  bib: ["BIB", "BIBs"],
  tshirt: ["T-shirt", "T-shirts"],
  pack: ["pack", "packs"],
};

/** "1 T-shirt", "3 BIBs", "2 packs". */
export function itemCount(kind: ExpoKind, n: number): string {
  return `${n} ${NOUN[kind][n === 1 ? 0 : 1]}`;
}

/** What to take from a T-shirt or pack bin: "1 × size M", "2 packs". */
export function takeWhat(kind: ExpoKind, bin: PickerBin): string {
  const left = bin.count - bin.picked;
  return kind === "tshirt" ? `${left} × size ${bin.size ?? "?"}` : itemCount(kind, left);
}

/** The line across the top of the camera: what to point it at now. */
export function cameraLine(task: PickerTask, step: Step): string {
  switch (step.type) {
    case "take":
      return `Take ${takeWhat(task.kind, step.bin)}, then scan the label on bin ${step.bin.code}`;
    case "open":
      return `Scan the label on bin ${step.bin.code}`;
    case "bib":
      return `Take BIB ${step.line.bib ?? "?"}, then scan it`;
    case "drop":
      return `Scan the label on pigeonhole ${task.crate ?? ""}`;
  }
}

/**
 * The pinned progress bar. It counts finished steps, so a scan that skips ahead still moves it.
 * label: "Step 2 of 3"; picked: "1 of 2 T-shirts picked".
 */
export function progress(task: PickerTask, steps: Step[]) {
  const done = steps.filter((s) => s.done).length;
  const picked = task.bins.reduce((n, b) => n + b.picked, 0);
  const count = task.bins.reduce((n, b) => n + b.count, 0);
  return {
    done,
    total: steps.length,
    label: `Step ${Math.min(done + 1, steps.length)} of ${steps.length}`,
    picked: `${picked} of ${itemCount(task.kind, count)} picked`,
  };
}
