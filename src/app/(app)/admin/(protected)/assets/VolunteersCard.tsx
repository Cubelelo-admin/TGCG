"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  DataTable,
  EmptyState,
  FieldLabel,
  Select,
  StatusPill,
  TextField,
  type ColumnDef,
  type StatusTone,
} from "@/components/ds";
import type { VolunteerRole } from "@/lib/admin-auth";
import type { ExpoKind } from "@/lib/expo";

export type { VolunteerRole };
export type Volunteer = {
  email: string;
  role: VolunteerRole;
  addedAt: string;
  /** Desk volunteers: the desk assigned to them (0033). */
  desk: string | null;
  /** Pickers: the items assigned to them (0033). */
  items: ExpoKind[];
};

const ROLE_OPTIONS: { value: VolunteerRole; label: string }[] = [
  { value: "desk", label: "Desk (collection desk)" },
  { value: "picker", label: "Picker (warehouse)" },
  { value: "handover", label: "Handover (corporate boxes)" },
  { value: "restock", label: "Restock (refills bins)" },
];
const ROLE_LABEL: Record<VolunteerRole, string> = { desk: "Desk", picker: "Picker", handover: "Handover", restock: "Restock" };
const ROLE_TONE: Record<VolunteerRole, StatusTone> = { desk: "info", picker: "warning", handover: "active", restock: "pending" };
const ITEMS: ExpoKind[] = ["bib", "tshirt", "pack"];
const ITEM_LABEL: Record<ExpoKind, string> = { bib: "BIB", tshirt: "T-shirt", pack: "Pack" };

type Body =
  | { action: "set"; email: string; role: VolunteerRole; desk?: string | null; items?: ExpoKind[] }
  | { action: "remove"; email: string };

async function post(body: Body): Promise<string | null> {
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

/** Turns one item on or off, keeping the BIB, T-shirt, Pack order. */
function toggle(items: ExpoKind[], k: ExpoKind): ExpoKind[] {
  return items.includes(k) ? items.filter((x) => x !== k) : ITEMS.filter((x) => x === k || items.includes(x));
}

/** "Not assigned" plus this event's desks. A stored desk that isn't one of them stays listed, marked. */
function deskOptions(stations: string[], current: string | null) {
  const extra = current && !stations.includes(current) ? [{ value: current, label: `${current} (not set up)` }] : [];
  return [{ value: "", label: "Not assigned" }, ...stations.map((s) => ({ value: s, label: `Desk ${s}` })), ...extra];
}

/** BIB / T-shirt / Pack toggles: the look of the DS FilterChip, which has no disabled state. */
function ItemChips({
  items,
  disabled,
  onToggle,
}: {
  items: ExpoKind[];
  disabled: boolean;
  onToggle: (k: ExpoKind) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ITEMS.map((k) => {
        const on = items.includes(k);
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(k)}
            className={`inline-flex h-7 items-center rounded-full px-3 text-12 disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? "bg-dark text-white" : "bg-line-secondary text-ink hover:bg-line"
            }`}
          >
            {on && "✓ "}
            {ITEM_LABEL[k]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Volunteers: Google emails with a volunteer role, and the desk or items assigned to them. They
 * use the volunteer app (/v), which shows the screen for their role; a change here reaches their
 * phone within a few seconds. No runner contact details, no registrations list.
 */
export default function VolunteersCard({
  volunteers,
  stations,
  adminCount,
}: {
  volunteers: Volunteer[];
  /** The current event's desks (pigeonhole stations). */
  stations: string[];
  adminCount: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<VolunteerRole>("picker");
  const [desk, setDesk] = useState("");
  const [items, setItems] = useState<ExpoKind[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, body: Body, after?: () => void) {
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

  function assignment(v: Volunteer) {
    if (v.role === "desk") {
      return (
        <Select
          ariaLabel={`Desk for ${v.email}`}
          options={deskOptions(stations, v.desk)}
          value={v.desk ?? ""}
          disabled={busy !== null}
          width={150}
          onChange={(next) => {
            if (next !== (v.desk ?? "")) {
              void run(`desk:${v.email}`, { action: "set", email: v.email, role: "desk", desk: next || null });
            }
          }}
        />
      );
    }
    if (v.role === "picker") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <ItemChips
            items={v.items}
            disabled={busy !== null}
            onToggle={(k) =>
              void run(`items:${v.email}`, { action: "set", email: v.email, role: "picker", items: toggle(v.items, k) })
            }
          />
          {v.items.length === 0 && <StatusPill tone="warning">Not assigned</StatusPill>}
        </div>
      );
    }
    return <span className="text-12 text-ink-muted">Not needed</span>;
  }

  const columns: ColumnDef<Volunteer>[] = [
    { key: "email", header: "Google email", render: (v) => <span className="break-all">{v.email}</span> },
    {
      key: "role",
      header: "Role",
      render: (v) => <StatusPill tone={ROLE_TONE[v.role]}>{ROLE_LABEL[v.role]}</StatusPill>,
    },
    { key: "assignment", header: "Desk or items", render: assignment },
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
                if (next !== v.role) void run(`role:${v.email}`, { action: "set", email: v.email, role: next as VolunteerRole });
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
    <Card title="Volunteers" className="max-w-4xl">
      <p className="-mt-2 mb-4 text-14 text-ink-tertiary">
        Volunteers open <span className="font-medium text-ink">/v</span> on their phone (installable as an app) and see
        the screen for their role. Desk volunteers work at the desk you assign; pickers get tasks for the items you
        assign, plus anything waiting over 90 s. Desk sees runner name, BIB and size; pickers see items, sizes, BIBs
        and crates; handover sees company groups and box codes; restock sees empty bins. Nobody sees phone numbers,
        emails or the registrations list. {adminCount} admin{adminCount === 1 ? "" : "s"} not shown (admins are managed
        in the database).
      </p>

      <form
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            "add",
            {
              action: "set",
              email,
              role,
              ...(role === "desk" ? { desk: desk || null } : {}),
              ...(role === "picker" ? { items } : {}),
            },
            () => {
              setEmail("");
              setDesk("");
              setItems([]);
            }
          );
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
        <Select
          label="Role"
          options={ROLE_OPTIONS}
          value={role}
          onChange={(v) => {
            setRole(v as VolunteerRole);
            setDesk("");
            setItems([]);
          }}
          width={240}
        />
        {role === "desk" && (
          <Select label="Desk" options={deskOptions(stations, null)} value={desk} onChange={setDesk} width={150} />
        )}
        {role === "picker" && (
          <div>
            <FieldLabel label="Items" />
            <div className="flex h-9 items-center">
              <ItemChips items={items} disabled={busy !== null} onToggle={(k) => setItems((cur) => toggle(cur, k))} />
            </div>
          </div>
        )}
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
