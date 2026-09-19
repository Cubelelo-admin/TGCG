import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export const WA_GROUP_KEYS = [
  "wa_group_42_21",
  "wa_group_10",
  "wa_group_6_1",
  "wa_group_6_2",
  "wa_group_6_3",
  "active_6k_wa_group",
] as const;
export type WaGroupKey = (typeof WA_GROUP_KEYS)[number];
export type WaGroupSettings = Record<WaGroupKey, string | null>;

export async function getWaGroupSettings(): Promise<WaGroupSettings> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("app_settings").select("key, value").in("key", WA_GROUP_KEYS);

  const settings = Object.fromEntries(WA_GROUP_KEYS.map((k) => [k, null])) as WaGroupSettings;
  for (const row of data ?? []) {
    if ((WA_GROUP_KEYS as readonly string[]).includes(row.key)) {
      settings[row.key as WaGroupKey] = row.value;
    }
  }
  return settings;
}

export async function saveWaGroupSettings(values: Partial<WaGroupSettings>): Promise<string | null> {
  const supabase = createServiceClient();
  const rows = Object.entries(values)
    .filter(([key]) => (WA_GROUP_KEYS as readonly string[]).includes(key))
    .map(([key, value]) => ({ key, value: value || null, updated_at: new Date().toISOString() }));
  if (rows.length === 0) return null;

  const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
  return error?.message ?? null;
}

/**
 * The 3 links to present in the ticket page's "Join WhatsApp Group" picker
 * — 6K resolved to whichever of its three groups is currently active.
 */
export async function getWaGroupLinks(): Promise<{
  group4221: string | null;
  group10: string | null;
  group6: string | null;
}> {
  const settings = await getWaGroupSettings();
  const activeKey =
    settings.active_6k_wa_group === "2"
      ? "wa_group_6_2"
      : settings.active_6k_wa_group === "3"
        ? "wa_group_6_3"
        : "wa_group_6_1";

  return {
    group4221: settings.wa_group_42_21,
    group10: settings.wa_group_10,
    group6: settings[activeKey],
  };
}
