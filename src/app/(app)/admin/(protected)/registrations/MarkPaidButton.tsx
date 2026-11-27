"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MANUAL_PAYMENT_MODE_LABELS, MANUAL_PAYMENT_MODES, type ManualPaymentMode } from "@/lib/manual-payment";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";
const optionClass = "bg-neutral-900 text-neutral-50";

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

/**
 * Manual payment override for a pending/failed registration whose payment
 * was collected directly (UPI to the organizer's account, cash, etc.).
 * Always confirms the whole booking — see the mark-paid route for why.
 */
export default function MarkPaidButton({ registrationId, name }: { registrationId: string; name: string }) {
  const router = useRouter();
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
      <button
        type="button"
        onClick={openDialog}
        title={`Mark ${name}'s booking as paid (payment collected directly)`}
        className="rounded-full border border-sky-400/40 px-3 py-1 text-xs font-medium text-sky-300 hover:border-sky-300"
      >
        Mark paid
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={onSubmit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-5 text-neutral-50 sm:p-6"
          >
            <h2 className="text-lg font-bold">Mark as paid — collected directly</h2>
            <p className="mt-1 text-xs text-neutral-400">
              For payments taken outside Razorpay (e.g. UPI to our account after a follow-up call). This
              confirms the whole booking, assigns BIBs and registration IDs, and sends the usual
              WhatsApp/email confirmation.
            </p>

            {loading && <p className="mt-4 text-sm text-neutral-400">Loading booking…</p>}

            {done && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                <p className="font-semibold text-emerald-300">Marked as paid.</p>
                <ul className="mt-2 space-y-1 text-neutral-200">
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
                <div className="mt-4 space-y-3">
                  {attendees.map((a) => {
                    const isTarget = targets.includes(a);
                    return (
                      <div key={a.id} className="rounded-lg border border-white/10 p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-medium">
                            {a.fullName}
                            <span className="ml-2 text-xs capitalize text-neutral-400">{a.paymentStatus}</span>
                          </p>
                          <p className="text-xs text-neutral-400">{a.category}</p>
                        </div>
                        {isTarget && a.missing.length > 0 && (
                          <p className="mt-2 text-xs text-amber-400">
                            Missing: {a.missing.join(", ")} — close this and fill them in with the edit (✎)
                            button on {a.id === registrationId ? "this" : "that attendee's"} row first.
                          </p>
                        )}
                        {isTarget && (
                          <label className="mt-2 block">
                            <span className="mb-1 block text-xs text-neutral-400">
                              Amount received (₹)
                              {a.categoryPrice !== null && a.categoryPrice !== a.amountInr && (
                                <span className="ml-1 text-amber-400">
                                  · current category price ₹{a.categoryPrice.toLocaleString("en-IN")}
                                </span>
                              )}
                            </span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              required
                              value={amounts[a.id] ?? ""}
                              onChange={(e) => setAmounts((m) => ({ ...m, [a.id]: e.target.value }))}
                              className={inputClass}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-neutral-400">Payment mode</span>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as ManualPaymentMode)}
                      className={inputClass}
                    >
                      {MANUAL_PAYMENT_MODES.map((m) => (
                        <option key={m} value={m} className={optionClass}>
                          {MANUAL_PAYMENT_MODE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-neutral-400">
                      UPI txn ID / UTR {needsRef ? "(required)" : "(optional)"}
                    </span>
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      required={needsRef}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs text-neutral-400">Note (optional)</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Collected on follow-up call by Ravi"
                    className={inputClass}
                  />
                </label>

                <label className="mt-4 flex items-start gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/[0.04]"
                  />
                  I&apos;ve verified ₹{total.toLocaleString("en-IN")} was received in our account for{" "}
                  {targets.length} attendee{targets.length === 1 ? "" : "s"}.
                </label>
              </>
            )}

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium hover:border-white/40 disabled:opacity-50"
              >
                {done ? "Close" : "Cancel"}
              </button>
              {!done && (
                <button
                  type="submit"
                  disabled={!canSubmit || saving}
                  className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-sky-300 disabled:opacity-40"
                >
                  {saving ? "Confirming..." : "Confirm payment"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  );
}
