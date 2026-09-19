"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WaGroupSettings } from "@/lib/app-settings";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";

export default function WhatsAppGroupsCard({ settings }: { settings: WaGroupSettings }) {
  const router = useRouter();
  const [form, setForm] = useState({
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="font-semibold">WhatsApp Groups</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Links shown on the ticket page&apos;s &quot;Join WhatsApp Group&quot; picker.
      </p>

      <div className="mt-4 grid gap-3">
        <Field label="21K / 42K Group Link">
          <input
            value={form.wa_group_42_21}
            onChange={(e) => setForm((f) => ({ ...f, wa_group_42_21: e.target.value }))}
            placeholder="https://chat.whatsapp.com/..."
            className={inputClass}
          />
        </Field>
        <Field label="10K Group Link">
          <input
            value={form.wa_group_10}
            onChange={(e) => setForm((f) => ({ ...f, wa_group_10: e.target.value }))}
            placeholder="https://chat.whatsapp.com/..."
            className={inputClass}
          />
        </Field>
        <Field label="6K Group Link 1">
          <input
            value={form.wa_group_6_1}
            onChange={(e) => setForm((f) => ({ ...f, wa_group_6_1: e.target.value }))}
            placeholder="https://chat.whatsapp.com/..."
            className={inputClass}
          />
        </Field>
        <Field label="6K Group Link 2">
          <input
            value={form.wa_group_6_2}
            onChange={(e) => setForm((f) => ({ ...f, wa_group_6_2: e.target.value }))}
            placeholder="https://chat.whatsapp.com/..."
            className={inputClass}
          />
        </Field>
        <Field label="6K Group Link 3">
          <input
            value={form.wa_group_6_3}
            onChange={(e) => setForm((f) => ({ ...f, wa_group_6_3: e.target.value }))}
            placeholder="https://chat.whatsapp.com/..."
            className={inputClass}
          />
        </Field>

        <label className="block">
          <span className="mb-1 block text-xs text-neutral-400">Currently Active 6K Group</span>
          <select
            value={form.active_6k_wa_group}
            onChange={(e) => setForm((f) => ({ ...f, active_6k_wa_group: e.target.value }))}
            className={inputClass}
          >
            <option value="1" className="bg-neutral-900">6K Group 1</option>
            <option value="2" className="bg-neutral-900">6K Group 2</option>
            <option value="3" className="bg-neutral-900">6K Group 3</option>
          </select>
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {saved && !error && <p className="mt-3 text-sm text-emerald-400">Saved.</p>}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="mt-4 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  );
}
