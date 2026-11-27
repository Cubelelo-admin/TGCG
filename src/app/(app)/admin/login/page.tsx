"use client";

import { useState } from "react";
import Image from "next/image";
import { Banner, Button } from "@/components/ds";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    }
    // On success the browser navigates to Google, then back to /auth/callback.
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-10">
      <div className="w-full max-w-[400px] rounded-12 border border-line-secondary bg-white p-8 text-center shadow-card">
        <Image src="/logo.png" alt="LetsRun" width={300} height={202} className="mx-auto h-14 w-auto rounded-8" />
        <h1 className="mt-5 text-20 font-semibold text-ink">TGCG Admin</h1>
        <p className="mt-1 text-14 text-ink-tertiary">Sign in to manage registrations</p>

        {error && (
          <div role="alert" className="mt-5 text-left">
            <Banner tone="danger">
              <span className="break-words">{error}</span>
            </Banner>
          </div>
        )}

        <Button type="button" variant="dark" onClick={signInWithGoogle} disabled={loading} className="mt-6 w-full">
          <span className="flex h-5 w-5 items-center justify-center rounded-4 bg-white">
            <GoogleIcon />
          </span>
          {loading ? "Redirecting…" : "Continue with Google"}
        </Button>

        <p className="mt-4 text-12 text-ink-muted">Only emails on the admin allowlist can access the dashboard.</p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}
