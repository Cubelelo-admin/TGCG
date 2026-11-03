import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { CHILD_RUNNER_CATEGORY_NAME } from "@/lib/registration-schema";
import type { Addon, EventRecord, TicketCategory } from "@/lib/types";
import { DEFAULT_EVENT_SLUG } from "@/lib/event-profiles";

export { DEFAULT_EVENT_SLUG } from "@/lib/event-profiles";

// Event records almost never change — every admin/registration page load was
// re-fetching one as its own sequential round trip, adding fixed latency to
// every navigation for no reason. Cached for a few minutes per slug; call
// revalidateTag("event") if one is ever edited from admin tooling.
//
// Public pages only ever see ACTIVE events: an event seeded inactive (e.g.
// Raigarh 2027 while its details are placeholders) renders "Registration is
// not open yet" and can't be checked out.
export const getEvent = unstable_cache(
  async (slug: string = DEFAULT_EVENT_SLUG): Promise<EventRecord | null> => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    return data;
  },
  ["get-event"],
  { revalidate: 300, tags: ["event"] }
);

/**
 * Every event, active or not — for the admin event switcher, so organizers
 * can review/bulk-import into an event before its public form goes live.
 */
export const listAllEvents = unstable_cache(
  async (): Promise<EventRecord[]> => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true });
    return data ?? [];
  },
  ["list-all-events"],
  { revalidate: 300, tags: ["event"] }
);

export async function getTicketCategories(eventId: string): Promise<TicketCategory[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .eq("hidden_from_picker", false)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((d) => ({ ...d, group: d.group as TicketCategory["group"] }));
}

/**
 * Every active category including hidden_from_picker (Child Runner) — unlike
 * getTicketCategories, which the public ticket picker uses and which
 * deliberately excludes it. Used by the admin bulk-import upload/preview,
 * which needs to be able to match against every category an offline
 * registration could belong to.
 */
export async function getBulkImportCategories(eventId: string): Promise<TicketCategory[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((d) => ({ ...d, group: d.group as TicketCategory["group"] }));
}

/** The one hidden category used by the "Add Child Runner" flow — never shown in the normal picker. */
export async function getChildRunnerCategory(eventId: string): Promise<TicketCategory | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("event_id", eventId)
    .eq("name", CHILD_RUNNER_CATEGORY_NAME)
    .eq("is_active", true)
    .maybeSingle();
  return data ? { ...data, group: data.group as TicketCategory["group"] } : null;
}

export async function getAddons(eventId: string): Promise<Addon[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("addons")
    .select("*")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return data ?? [];
}
