"use client";

import { useTransition } from "react";
import { Icon, Menu, MenuItem, Popover, RoleBadge } from "@/components/ds";
import { selectAdminEvent } from "./actions";

/**
 * Dock topbar org switcher, used as the admin event switcher: event name + NOT OPEN badge + chevron,
 * opening a menu of every event. Choosing a different event submits it to selectAdminEvent exactly
 * as the old <select> did (FormData "event" = slug); choosing the current one just closes the menu,
 * as a <select> fires no change for the same value. With fewer than two events there is nothing
 * to switch, so only the current event's name is shown.
 */
export default function EventSwitcher({
  events,
  selectedSlug,
}: {
  events: { slug: string; name: string; is_active: boolean }[];
  selectedSlug: string | null;
}) {
  const [pending, startTransition] = useTransition();
  // A <select> with no matching value shows its first option, so fall back to the first event.
  const selected = events.find((e) => e.slug === selectedSlug) ?? events[0] ?? null;

  if (events.length < 2) {
    if (!selected) return null;
    return (
      <div className="flex h-[33px] min-w-0 items-center gap-2 px-2 py-1.5">
        <span className="truncate text-14 font-medium text-ink">{selected.name}</span>
        {!selected.is_active && <RoleBadge>Not open</RoleBadge>}
      </div>
    );
  }

  function choose(slug: string) {
    if (slug === selected?.slug) return;
    const formData = new FormData();
    formData.set("event", slug);
    startTransition(() => selectAdminEvent(formData));
  }

  return (
    <Popover
      className="min-w-0 max-w-full"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-label={`Event: ${selected?.name ?? "none"}${selected && !selected.is_active ? " (not open)" : ""}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-busy={pending}
          onClick={toggle}
          disabled={pending}
          className={`flex h-[33px] min-w-0 max-w-full items-center gap-2 rounded-8 px-2 py-1.5 disabled:cursor-wait disabled:opacity-50 ${
            open ? "bg-surface-secondary" : "hover:bg-surface-secondary"
          }`}
        >
          <span className="truncate text-14 font-medium text-ink">{selected?.name ?? "Select event"}</span>
          {selected && !selected.is_active && <RoleBadge>Not open</RoleBadge>}
          {pending ? (
            <Icon name="refresh" size={14} className="shrink-0 animate-spin text-ink" />
          ) : (
            <Icon name={open ? "chevronUp" : "chevronDown"} size={14} className="shrink-0 text-ink" />
          )}
        </button>
      )}
    >
      {(close) => (
        // Below md the trigger starts ~52px in (header padding + menu button + gap), so leave room for that offset.
        <div className="w-[min(320px,calc(100vw-68px))] p-1.5 md:w-[min(320px,calc(100vw-16px))]">
          <p className="px-3 py-1.5 text-12 font-medium uppercase tracking-wide text-ink-muted">Events</p>
          <Menu>
            {events.map((e) => (
              <MenuItem
                key={e.slug}
                active={e.slug === selected?.slug}
                trailing={e.is_active ? undefined : <RoleBadge>Not open</RoleBadge>}
                onClick={() => {
                  close();
                  choose(e.slug);
                }}
              >
                {e.name}
              </MenuItem>
            ))}
          </Menu>
        </div>
      )}
    </Popover>
  );
}
