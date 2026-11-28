import { Icon } from "@/components/ds";

/** A change the supervisor made to a volunteer's desk or items (0033), or a missing assignment. */
export type Note = { tone: "info" | "warn"; title: string; text: string } | null;

/**
 * Shown on the desk and picker screens: blue for information, amber for a warning. With
 * onDismiss it has a × and stays until the volunteer closes it. (Part 2 restyles every alert.)
 */
export function AssignmentNote({ note, onDismiss }: { note: Note; onDismiss?: () => void }) {
  if (!note) return null;
  const warn = note.tone === "warn";
  return (
    <div
      role={warn ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-12 px-4 py-3 ${
        warn ? "bg-tint-orange text-on-tint-orange" : "bg-tint-blue text-on-tint-blue"
      }`}
    >
      <Icon name={warn ? "alert" : "info"} size={22} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-16 font-semibold">{note.title}</p>
        {note.text && <p className="mt-0.5 text-14 text-ink">{note.text}</p>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-mr-1 shrink-0 px-1 text-20 leading-none">
          ×
        </button>
      )}
    </div>
  );
}
