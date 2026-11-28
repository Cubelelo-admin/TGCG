"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Card,
  EmptyState,
  InstallPrompt,
  Popover,
  SegmentedControl,
} from "@/components/ds";
import type { AdminRole, VolunteerRole } from "@/lib/admin-auth";
import DeskStation from "../admin/(protected)/kit/desk/DeskStation";
import PickerStation from "../admin/(protected)/kit/picker/PickerStation";
import HandoverStation from "../admin/(protected)/kit/handover/HandoverStation";
import RestockStation from "../admin/(protected)/kit/restock/RestockStation";
import SignOutButton from "../admin/(protected)/SignOutButton";
import { usePoll } from "../admin/(protected)/kit/expo-client";

export const ROLE_TITLE: Record<VolunteerRole, string> = {
  desk: "Collection desk",
  picker: "Picker",
  handover: "Corporate handover",
  restock: "Restock",
};

const ROLE_HINT: Record<VolunteerRole, string> = {
  desk: "Scan the runner's pass to start an order. When it turns Ready, scan the crate and hand over.",
  picker:
    "Tap Start to receive tasks. Scan the bin, pick, then scan the crate.",
  handover:
    "Stage each ready group box. On day 0, scan every box of a group out to the company rep.",
  restock: "Refill bins pickers flag as empty, then scan the bin label.",
};

/**
 * The volunteer app: one URL, the role picks the screen. Polls the role so an admin's change in
 * Configuration → Volunteers switches this phone's screen within ~10 s (and a removed volunteer
 * is signed out of the screen). Admins get a switcher to see any role's screen.
 */
export default function VolunteerApp({
  email,
  role,
  view,
  eventId,
  eventName,
  stations,
  assignedDesk,
}: {
  email: string;
  /** The signed-in user's real role. */
  role: AdminRole;
  /** The screen being shown: the volunteer's role, or the admin's chosen preview. */
  view: VolunteerRole;
  eventId: string | null;
  eventName: string;
  stations: string[];
  /** Desk volunteers: the desk the admin assigned (0033), null = none yet. */
  assignedDesk: string | null;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";
  // Kept up to date by the desk screen's poll, for the header.
  const [desk, setDesk] = useState(assignedDesk);
  const roleRef = useRef(role);

  usePoll(async () => {
    const res = await fetch("/api/v/me", { cache: "no-store" }).catch(
      () => null,
    );
    if (!res) return;
    if (res.status === 401) {
      router.replace("/v/login");
      return;
    }
    const json = (await res.json().catch(() => null)) as {
      role: AdminRole | null;
    } | null;
    if (!json) return;
    if (json.role !== roleRef.current) {
      roleRef.current = json.role ?? roleRef.current;
      // The server page re-reads the role and renders the new screen (or the denied page).
      router.refresh();
    }
  }, 10_000);

  return (
    <div className="min-h-dvh bg-surface-page">
      <header className="sticky top-0 z-30 bg-dark text-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-3">
          <Image
            src="/app-icons/volunteer-192.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-8"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-16 font-semibold">
              {ROLE_TITLE[view]}
              {view === "desk" && !isAdmin && desk ? ` · ${desk}` : ""}
            </p>
            <p className="truncate text-12 text-white/60">{eventName}</p>
          </div>
          <Popover
            align="right"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-label="Account"
                className={`flex h-9 w-9 items-center justify-center rounded-full text-14 font-semibold ${
                  open ? "bg-white text-dark" : "bg-white/15 text-white"
                }`}
              >
                {(email.trim()[0] ?? "?").toUpperCase()}
              </button>
            )}
          >
            {() => (
              <div className="w-[min(300px,calc(100vw-24px))] p-1.5">
                <div className="rounded-4 bg-surface-tertiary px-3 py-2">
                  <p className="text-12 text-ink-tertiary">Signed in as</p>
                  <p className="truncate text-14 font-medium text-ink">
                    {email}
                  </p>
                  <p className="text-12 text-ink-tertiary">
                    {isAdmin
                      ? "Admin (previewing)"
                      : ROLE_TITLE[role as VolunteerRole]}
                  </p>
                </div>
                <div className="my-1.5 h-px bg-line-secondary" />
                <SignOutButton variant="menu" to="/v/login" />
              </div>
            )}
          </Popover>
        </div>
        {isAdmin && (
          <div className="mx-auto max-w-5xl overflow-x-auto px-3 pb-2">
            <SegmentedControl
              ariaLabel="Preview a volunteer screen"
              value={view}
              onChange={(next) => router.replace(`/v?as=${next}`)}
              options={(Object.keys(ROLE_TITLE) as VolunteerRole[]).map(
                (r) => ({
                  value: r,
                  label:
                    r === "handover"
                      ? "Handover"
                      : ROLE_TITLE[r].replace("Collection desk", "Desk"),
                }),
              )}
            />
          </div>
        )}
      </header>

      <main
        className={`mx-auto px-3 pb-8 pt-4 ${view === "desk" ? "max-w-5xl" : "max-w-lg"}`}
      >
        {eventId ? (
          <>
            <p className="mb-4 text-14 text-ink-tertiary">{ROLE_HINT[view]}</p>
            {view === "desk" && (
              <DeskStation
                key="desk"
                eventId={eventId}
                stations={stations}
                canCancel={isAdmin}
                assignedDesk={isAdmin ? undefined : assignedDesk}
                onDeskChange={setDesk}
              />
            )}
            {view === "picker" && (
              <PickerStation key="picker" eventId={eventId} />
            )}
            {view === "handover" && (
              <HandoverStation key="handover" eventId={eventId} />
            )}
            {view === "restock" && (
              <RestockStation key="restock" eventId={eventId} />
            )}
          </>
        ) : (
          <Card>
            <EmptyState title="No active event found." />
          </Card>
        )}
      </main>

      <InstallPrompt
        variant="sheet"
        appId="volunteer"
        appName="TGCG Crew"
        description="Add it to your home screen: it opens full screen, like an app."
        iconSrc="/app-icons/volunteer-192.png"
        snoozeDays={1}
      />
    </div>
  );
}
