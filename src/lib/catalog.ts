import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
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
    .order("sort_order", { ascending: true });
  return (data ?? []).map((d) => ({ ...d, group: d.group as TicketCategory["group"] }));
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
