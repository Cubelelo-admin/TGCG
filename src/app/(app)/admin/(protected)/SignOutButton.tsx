"use client";

import { useRouter } from "next/navigation";
import { Button, Icon, MenuItem } from "@/components/ds";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/**
 * Signs out of Supabase and returns to a login page (/admin/login by default).
 * variant "outline" / "dark": a Dock Button. variant "menu": a row for the account menu.
 */
export default function SignOutButton({
  className = "",
  variant = "outline",
  to = "/admin/login",
}: {
  className?: string;
  variant?: "outline" | "dark" | "menu";
  /** Where to go after signing out. */
  to?: string;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push(to);
    router.refresh();
  }

  if (variant === "menu") {
    return (
      <MenuItem icon={<Icon name="logout" size={16} className="text-ink-tertiary" />} onClick={signOut}>
        Sign out
      </MenuItem>
    );
  }

  return (
    <Button type="button" variant={variant} onClick={signOut} className={className}>
      <Icon name="logout" size={16} />
      Sign out
    </Button>
  );
}
