"use client";

import { useState } from "react";

export default function ResendWaButton({ registrationId }: { registrationId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    setState("sending");
    try {
      const res = await fetch("/api/admin/resend-wa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      onClick={resend}
      disabled={state === "sending"}
      className="rounded-full border border-white/20 px-3 py-1 text-xs font-medium hover:border-white/40 disabled:opacity-50"
    >
      {state === "idle" && "Resend confirmation"}
      {state === "sending" && "Sending..."}
      {state === "sent" && "Sent"}
      {state === "error" && "Failed — retry"}
    </button>
  );
}
