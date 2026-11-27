"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WaGroupSettings } from "@/lib/app-settings";
import { Button, Card, Icon, Select, StatusPill, TextField } from "@/components/ds";

type FormState = {
  wa_group_42_21: string;
  wa_group_10: string;
  wa_group_6_1: string;
  wa_group_6_2: string;
  wa_group_6_3: string;
  active_6k_wa_group: string;
};

type LinkKey = Exclude<keyof FormState, "active_6k_wa_group">;

const LINK_ROWS: { key: LinkKey; label: string; activeValue?: string }[] = [
  { key: "wa_group_42_21", label: "21K / 42K Group Link" },
  { key: "wa_group_10", label: "10K Group Link" },
  { key: "wa_group_6_1", label: "6K Group Link 1", activeValue: "1" },
  { key: "wa_group_6_2", label: "6K Group Link 2", activeValue: "2" },
  { key: "wa_group_6_3", label: "6K Group Link 3", activeValue: "3" },
];

const ACTIVE_6K_OPTIONS = [
  { value: "1", label: "6K Group 1" },
  { value: "2", label: "6K Group 2" },
  { value: "3", label: "6K Group 3" },
];

export default function WhatsAppGroupsCard({ settings }: { settings: WaGroupSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    wa_group_42_21: settings.wa_group_42_21 ?? "",
    wa_group_10: settings.wa_group_10 ?? "",
    wa_group_6_1: settings.wa_group_6_1 ?? "",
    wa_group_6_2: settings.wa_group_6_2 ?? "",
    wa_group_6_3: settings.wa_group_6_3 ?? "",
    active_6k_wa_group: settings.active_6k_wa_group ?? "1",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Display-only: the server treats anything other than "2"/"3" as group 1 (src/lib/app-settings.ts),
  // so show it that way. The form state and PATCH body keep the raw value.
  const shownActive6k =
    form.active_6k_wa_group === "2" || form.active_6k_wa_group === "3" ? form.active_6k_wa_group : "1";
  const shownActive6kLabel = ACTIVE_6K_OPTIONS.find((o) => o.value === shownActive6k)?.label ?? "";
  // The "Active" pill reflects what is live (saved), not unsaved edits.
  const liveActive6k =
    settings.active_6k_wa_group === "2" || settings.active_6k_wa_group === "3" ? settings.active_6k_wa_group : "1";

  async function onSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/settings/wa-groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Save failed");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="max-w-3xl">
      {/* Settings-card header: icon tile inline with the title. */}
      <div className="flex items-center gap-3">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10.5px] bg-surface-tertiary text-ink">
          <Icon name="whatsapp" size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-18 font-semibold text-ink">WhatsApp Groups</h2>
          <p className="text-14 text-ink-tertiary">
            Links shown on the ticket page&apos;s &quot;Join WhatsApp Group&quot; picker.
          </p>
        </div>
      </div>

      {/* No overflow-hidden here: it would clip the Select's popover in the last row. */}
      <div className="mt-5 rounded-8 border border-line">
        {LINK_ROWS.map((row) => {
          const id = `wa-${row.key}`;
          const isActive6k = row.activeValue !== undefined && row.activeValue === liveActive6k;
          return (
            <div
              key={row.key}
              className="grid gap-2 border-b border-line-secondary px-4 py-3 sm:grid-cols-[200px_1fr] sm:items-center sm:gap-4"
            >
              <label htmlFor={id} className="flex items-center gap-2 text-12 font-medium text-ink-secondary">
                {row.label}
                {isActive6k && <StatusPill tone="active">Active</StatusPill>}
              </label>
              <TextField
                id={id}
                value={form[row.key]}
                onChange={(e) => setForm((f) => ({ ...f, [row.key]: e.target.value }))}
                placeholder="https://chat.whatsapp.com/..."
              />
            </div>
          );
        })}

        <div className="grid gap-2 rounded-b-8 bg-surface-secondary px-4 py-3 sm:grid-cols-[200px_1fr] sm:items-center sm:gap-4">
          <span className="text-12 font-medium text-ink-secondary">Currently Active 6K Group</span>
          <Select
            options={ACTIVE_6K_OPTIONS}
            value={shownActive6k}
            onChange={(v) => setForm((f) => ({ ...f, active_6k_wa_group: v }))}
            ariaLabel={`Currently Active 6K Group: ${shownActive6kLabel}`}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-14 text-[#D92D20]">
            <Icon name="alert" size={16} className="shrink-0" />
            {error}
          </p>
        )}
        {saved && !error && (
          <p role="status" className="flex items-center gap-1.5 text-14 text-on-tint-green">
            <Icon name="checkCircle" size={16} className="shrink-0" />
            Saved.
          </p>
        )}
        <Button type="button" variant="dark" onClick={onSave} disabled={saving}>
          <Icon name="save" size={16} />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </Card>
  );
}
