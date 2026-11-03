import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_EVENT_SLUG, listAllEvents } from "@/lib/catalog";
import type { EventRecord } from "@/lib/types";

/** Which event the admin pages are looking at — chosen with the switcher in the admin header. */
export const ADMIN_EVENT_COOKIE = "admin_event";

/**
 * The event selected in the admin header (any event, active or not, so
 * organizers can work on an event before its public form opens), falling
 * back to TGCG 2026. Every admin page/route that lists, totals, exports or
 * imports registrations scopes itself to this.
 */
export async function getAdminEvent(): Promise<{ event: EventRecord | null; events: EventRecord[] }> {
  const [events, cookieStore] = await Promise.all([listAllEvents(), cookies()]);
  const selected = cookieStore.get(ADMIN_EVENT_COOKIE)?.value;
  const event =
    events.find((e) => e.slug === selected) ?? events.find((e) => e.slug === DEFAULT_EVENT_SLUG) ?? events[0] ?? null;
  return { event, events };
}
