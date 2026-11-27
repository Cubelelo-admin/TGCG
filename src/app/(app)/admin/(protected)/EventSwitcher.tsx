"use client";

import { useTransition } from "react";
import { selectAdminEvent } from "./actions";

export default function EventSwitcher({
  events,
  selectedSlug,
}: {
  events: { slug: string; name: string; is_active: boolean }[];
  selectedSlug: string | null;
}) {
  const [pending, startTransition] = useTransition();
  if (events.length < 2) return null;

  return (
    <select
      aria-label="Event"
      value={selectedSlug ?? ""}
      disabled={pending}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("event", e.target.value);
        startTransition(() => selectAdminEvent(formData));
      }}
      className="max-w-[220px] rounded-lg border border-white/15 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-50 focus:border-emerald-400 focus:outline-none disabled:opacity-50"
    >
      {events.map((e) => (
        <option key={e.slug} value={e.slug} className="bg-neutral-900 text-neutral-50">
          {e.name}
          {e.is_active ? "" : " (not open)"}
        </option>
      ))}
    </select>
  );
}
