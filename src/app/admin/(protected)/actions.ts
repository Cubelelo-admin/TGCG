"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin-auth";
import { ADMIN_EVENT_COOKIE } from "@/lib/admin-event";
import { listAllEvents } from "@/lib/catalog";

/** Admin header event switcher — remembers the chosen event for this browser. */
export async function selectAdminEvent(formData: FormData) {
  const session = await getAdminSession();
  if (!session?.authorized) return;

  const slug = String(formData.get("event") ?? "");
  const events = await listAllEvents();
  if (!events.some((e) => e.slug === slug)) return;

  (await cookies()).set(ADMIN_EVENT_COOKIE, slug, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/admin", "layout");
}
