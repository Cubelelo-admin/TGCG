"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, Card, DataTable, EmptyState, Select, StatusPill, TextField, type ColumnDef, type StatusTone } from "@/components/ds";
import type { VolunteerRole } from "@/lib/admin-auth";

export type { VolunteerRole };
export type Volunteer = { email: string; role: VolunteerRole; addedAt: string };

const ROLE_OPTIONS: { value: VolunteerRole; label: string }[] = [
  { value: "desk", label: "Desk (collection desk)" },
  { value: "picker", label: "Picker (warehouse)" },
  { value: "handover", label: "Handover (corporate boxes)" },
  { value: "restock", label: "Restock (refills bins)" },
];
const ROLE_LABEL: Record<VolunteerRole, string> = { desk: "Desk", picker: "Picker", handover: "Handover", restock: "Restock" };
const ROLE_TONE: Record<VolunteerRole, StatusTone> = { desk: "info", picker: "warning", handover: "active", restock: "pending" };

async function post(body: Record<string, string>): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/volunteers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return json.error ?? "Save failed";
  } catch {
    return "No connection: try again";
  }
}

/**
 * Volunteers: Google emails with a volunteer role. They use the volunteer app (/v), which
 * shows the screen for their role; changing the role here switches their phone's screen
 * within a few seconds. No runner contact details, no registrations list.
 */
export default function VolunteersCard({ volunteers, adminCount }: { volunteers: Volunteer[]; adminCount: number }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<VolunteerRole>("picker");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, body: Record<string, string>, after?: () => void) {
    setBusy(key);
    setError(null);
    const err = await post(body);
    setBusy(null);
    if (err) {
      setError(err);
      return;
    }
    after?.();
    router.refresh();
  }

  const columns: ColumnDef<Volunteer>[] = [
    { key: "email", header: "Google email", render: (v) => <span className="break-all">{v.email}</span> },
    {
      key: "role",
      header: "Role",
      render: (v) => <StatusPill tone={ROLE_TONE[v.role]}>{ROLE_LABEL[v.role]}</StatusPill>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (v) => {
        return (
          <div className="flex items-center justify-end gap-2">
            <Select
              ariaLabel={`Role for ${v.email}`}
              options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: ROLE_LABEL[o.value] }))}
              value={v.role}
              disabled={busy !== null}
              width={140}
              onChange={(next) => {
                if (next !== v.role) void run(`role:${v.email}`, { action: "set", email: v.email, role: next });
              }}
            />
            <Button
              size="sm"
              variant="red"
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm(`Remove ${v.email}? They lose access within a few seconds.`)) {
                  void run(`rm:${v.email}`, { action: "remove", email: v.email });
                }
              }}
            >
              Remove
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <Card title="Volunteers" className="max-w-3xl">
      <p className="-mt-2 mb-4 text-14 text-ink-tertiary">
        Volunteers open <span className="font-medium text-ink">/v</span> on their phone (installable as an app) and see
        the screen for their role. Desk sees runner name, BIB and size; pickers see items, sizes, BIBs and crates;
        handover sees company groups and box codes; restock sees empty bins. Nobody sees phone numbers, emails or the
        registrations list. {adminCount} admin{adminCount === 1 ? "" : "s"} not shown (admins are managed in the
        database).
      </p>

      <form
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run("add", { action: "set", email, role }, () => setEmail(""));
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField
            label="Google email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="volunteer@gmail.com"
          />
        </div>
        <Select label="Role" options={ROLE_OPTIONS} value={role} onChange={(v) => setRole(v as VolunteerRole)} width={240} />
        <Button type="submit" variant="dark" disabled={busy !== null || !email.trim()}>
          {busy === "add" ? "Adding…" : "Add volunteer"}
        </Button>
      </form>

      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={volunteers}
        rowKey={(v) => v.email}
        minWidth={0}
        empty={<EmptyState title="No volunteers yet" />}
      />
    </Card>
  );
}
