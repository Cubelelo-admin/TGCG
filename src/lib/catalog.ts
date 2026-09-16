import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { CHILD_RUNNER_CATEGORY_NAME } from "@/lib/registration-schema";
import type { Addon, EventRecord, TicketCategory } from "@/lib/types";

export const EVENT_SLUG = "tgcg-2026";

export async function getEvent(): Promise<EventRecord | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("slug", EVENT_SLUG)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

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
