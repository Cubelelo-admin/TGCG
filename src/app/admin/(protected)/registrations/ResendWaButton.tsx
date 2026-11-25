"use client";

import { useState } from "react";
import { Button, Icon } from "@/components/ds";

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
    <Button
      type="button"
      size="sm"
      variant={state === "error" ? "red" : "green"}
      onClick={resend}
      disabled={state === "sending"}
    >
      {state === "idle" && (
        <>
          <Icon name="whatsapp" size={14} />
          Resend confirmation
        </>
      )}
      {state === "sending" && "Sending..."}
      {state === "sent" && (
        <>
          <Icon name="check" size={14} />
          Sent
        </>
      )}
      {state === "error" && (
        <>
          <Icon name="refresh" size={14} />
          Failed — retry
        </>
      )}
    </Button>
  );
}
