"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Banner, Button, Icon, TextField } from "@/components/ds";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/**
 * Volunteer app sign-in. Email code first: it works everywhere, including an app installed to
 * an iPhone home screen, where a Google sign-in can end up in a separate Safari view. Google
 * stays available (fine in a browser tab and on Android).
 */
export default function VolunteerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Couldn't send the code: try again");
      } else {
        setInfo(json.message ?? "Check your email for the code.");
        setStep("code");
      }
    } catch {
      setError("No connection: try again");
    }
    setBusy(false);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "email" });
    if (verifyError) {
      setError(/expired|invalid/i.test(verifyError.message) ? "That code is wrong or has expired. Request a new one." : verifyError.message);
      setBusy(false);
      return;
    }
    router.replace("/v");
    router.refresh();
  }

  async function google() {
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/v` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-dark px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="flex flex-col items-center text-center text-white">
          <Image src="/app-icons/volunteer-192.png" alt="" width={72} height={72} className="h-18 w-18 rounded-12 ring-1 ring-white/20" priority />
          <h1 className="mt-4 text-24 font-semibold">TGCG Volunteers</h1>
          <p className="mt-1 text-14 text-white/70">Sign in with the email the organisers added.</p>
        </div>

        <div className="mt-8 rounded-12 bg-white p-5 shadow-dock-xl">
          {error && (
            <div role="alert" className="mb-4">
              <Banner tone="danger">{error}</Banner>
            </div>
          )}

          {step === "email" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
              className="flex flex-col gap-4"
            >
              <TextField
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
              />
              <Button type="submit" variant="dark" disabled={busy || !email.trim()} className="h-12! text-16!">
                {busy ? "Sending…" : "Email me a code"}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verify();
              }}
              className="flex flex-col gap-4"
            >
              {info && <p className="text-14 text-ink-secondary">{info}</p>}
              <TextField
                label="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="123456"
              />
              <Button type="submit" variant="dark" disabled={busy || code.length < 6} className="h-12! text-16!">
                {busy ? "Checking…" : "Sign in"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setInfo(null);
                }}
                className="text-14 font-medium text-link"
              >
                Use a different email
              </button>
            </form>
          )}

          <div className="my-5 flex items-center gap-3 text-12 text-ink-muted">
            <span className="h-px flex-1 bg-line-secondary" />
            or
            <span className="h-px flex-1 bg-line-secondary" />
          </div>
          <Button type="button" onClick={google} disabled={busy} className="h-12! w-full">
            <Icon name="globe" size={18} />
            Continue with Google
          </Button>
          <p className="mt-3 text-12 text-ink-muted">On an iPhone home-screen app, use the email code.</p>
        </div>
      </div>
    </main>
  );
}
