"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MANUAL_PAYMENT_MODE_LABELS, MANUAL_PAYMENT_MODES, type ManualPaymentMode } from "@/lib/manual-payment";
import {
  Banner,
  Button,
  Checkbox,
  FieldLabel,
  Modal,
  StatusPill,
  TextField,
  inputClass,
  type StatusTone,
} from "@/components/ds";

type Attendee = {
  id: string;
  fullName: string;
  category: string | null;
  categoryPrice: number | null;
  paymentStatus: string;
  amountInr: number;
  missing: string[];
};

type Confirmed = { id: string; full_name: string; registration_code: string | null; bib_number: string | null };

const PAYMENT_TONES: Record<string, StatusTone> = {
  paid: "active",
  pending: "pending",
  failed: "expired",
  refunded: "info",
  cancelled: "pending",
};

/**
 * Manual payment override for a pending/failed registration whose payment
 * was collected directly (UPI to the organizer's account, cash, etc.).
 * Always confirms the whole booking — see the mark-paid route for why.
 */
export default function MarkPaidButton({ registrationId, name }: { registrationId: string; name: string }) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<ManualPaymentMode>("upi");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState<Confirmed[] | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  async function openDialog() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setDone(null);
    setConfirmed(false);
    try {
      const res = await fetch(`/api/admin/registrations/${registrationId}/mark-paid`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load booking");
      const list = body.attendees as Attendee[];
      setAttendees(list);
      setAmounts(Object.fromEntries(list.map((a) => [a.id, String(a.amountInr)])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load booking");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    if (done) router.refresh();
  }

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  // Like the old dialog, this only closes from the footer Cancel/Close button
  // (hideClose turns off ✕, Esc and overlay click), so entered amounts and the
  // verified checkbox can't be lost to a stray click. Mid-save it stays open.
  function requestClose() {
    if (saving) return;
    close();
  }

  const targets = (attendees ?? []).filter((a) => a.paymentStatus === "pending" || a.paymentStatus === "failed");
  const incomplete = targets.filter((a) => a.missing.length > 0);
  const total = targets.reduce((sum, a) => sum + (Number(amounts[a.id]) || 0), 0);
  const needsRef = mode === "upi" || mode === "bank_transfer";
  const amountsValid = targets.every((a) => amounts[a.id] !== "" && Number(amounts[a.id]) >= 0);
  const canSubmit =
    targets.length > 0 && incomplete.length === 0 && amountsValid && (!needsRef || reference.trim()) && confirmed;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/admin/registrations/${registrationId}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        reference,
        note,
        amounts: Object.fromEntries(targets.map((a) => [a.id, Number(amounts[a.id])])),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? "Could not mark as paid");
      return;
    }
    setDone(body.registrations as Confirmed[]);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="orange"
        onClick={openDialog}
        title={`Mark ${name}'s booking as paid (payment collected directly)`}
      >
        Mark paid
      </Button>

      <Modal
        open={open}
        onClose={requestClose}
        hideClose
        icon="checkCircle"
        title="Mark as paid — collected directly"
        subtitle="For payments taken outside Razorpay (e.g. UPI to our account after a follow-up call). This confirms the whole booking, assigns BIBs and registration IDs, and sends the usual WhatsApp/email confirmation."
        width={520}
        footer={
          <>
            <Button type="button" size="sm" onClick={close} disabled={saving}>
              {done ? "Close" : "Cancel"}
            </Button>
            {!done && (
              <Button type="submit" form={formId} size="sm" variant="dark" disabled={!canSubmit || saving}>
                {saving ? "Confirming…" : "Confirm payment"}
              </Button>
            )}
          </>
        }
      >
        <form id={formId} onSubmit={onSubmit} className="pt-4">
          {/* Top of the scroll area (and scrolled to) so a failed confirm is never below the fold. */}
          {error && (
            <div ref={errorRef} className="mb-4">
              <Banner tone="danger">{error}</Banner>
            </div>
          )}

          {loading &&<p className="text-14 text-ink-muted">Loading booking…</p>}

          {done && (
            <div className="rounded-8 border border-line-secondary p-4">
              <StatusPill tone="active">Marked as paid.</StatusPill>
              <ul className="mt-3 space-y-1.5 text-14 text-ink">
                {done.map((r) => (
                  <li key={r.id}>
                    {r.full_name} — <span className="font-mono">{r.registration_code ?? "—"}</span> · BIB{" "}
                    <span className="font-mono">{r.bib_number ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && !done && attendees && (
            <>
              <div className="space-y-3">
                {attendees.map((a) => {
                  const isTarget = targets.includes(a);
                  const amountId = `${formId}-amount-${a.id}`;
                  return (
                    <div key={a.id} className="rounded-8 border border-line-secondary p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex flex-wrap items-center gap-2 text-14 font-medium text-ink">
                          {a.fullName}
                          <span className="capitalize">
                            <StatusPill tone={PAYMENT_TONES[a.paymentStatus] ?? "pending"}>{a.paymentStatus}</StatusPill>
                          </span>
                        </p>
                        <p className="text-12 text-ink-tertiary">{a.category}</p>
                      </div>
                      {isTarget && a.missing.length > 0 && (
                        <p className="mt-2 text-12 text-on-tint-orange">
                          Missing: {a.missing.join(", ")} — close this and fill them in with the edit (✎)
                          button on {a.id === registrationId ? "this" : "that attendee's"} row first.
                        </p>
                      )}
                      {isTarget && (
                        <div className="mt-3">
                          <label
                            htmlFor={amountId}
                            className="mb-1.5 flex flex-wrap items-center gap-1 text-12 font-medium text-ink-secondary"
                          >
                            Amount received (₹)
                            <span className="text-[#D92D20]">*</span>
                            {a.categoryPrice !== null && a.categoryPrice !== a.amountInr && (
                              <span className="ml-1 font-normal text-on-tint-orange">
                                · current category price ₹{a.categoryPrice.toLocaleString("en-IN")}
                              </span>
                            )}
                          </label>
                          <input
                            id={amountId}
                            type="number"
                            min={0}
                            step="0.01"
                            required
                            value={amounts[a.id] ?? ""}
                            onChange={(e) => setAmounts((m) => ({ ...m, [a.id]: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <FieldLabel label="Payment mode" htmlFor={`${formId}-mode`} />
                  <select
                    id={`${formId}-mode`}
                    value={mode}
                    onChange={(e) => setMode(e.target.value as ManualPaymentMode)}
                    className={inputClass}
                  >
                    {MANUAL_PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {MANUAL_PAYMENT_MODE_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
                <TextField
                  id={`${formId}-reference`}
                  label={`UPI txn ID / UTR ${needsRef ? "(required)" : "(optional)"}`}
                  className="min-w-0"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  required={needsRef}
                />
              </div>
              <TextField
                id={`${formId}-note`}
                label="Note (optional)"
                className="mt-4"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Collected on follow-up call by Ravi"
              />

              <div className="mt-4">
                <Checkbox
                  checked={confirmed}
                  onChange={setConfirmed}
                  label={
                    <>
                      I&apos;ve verified ₹{total.toLocaleString("en-IN")} was received in our account for{" "}
                      {targets.length} attendee{targets.length === 1 ? "" : "s"}.
                    </>
                  }
                />
              </div>
            </>
          )}

        </form>
      </Modal>
    </>
  );
}
