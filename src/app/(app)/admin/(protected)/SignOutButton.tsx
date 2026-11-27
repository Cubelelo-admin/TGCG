"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className={`rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium hover:border-white/40 ${className}`}
    >
      Sign out
    </button>
  );
}
