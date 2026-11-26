"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon, InstallPrompt, Popover, Sidebar, type IconName, type NavItemDef } from "@/components/ds";
import EventSwitcher from "./EventSwitcher";
import SignOutButton from "./SignOutButton";

type AdminEventOption = { slug: string; name: string; is_active: boolean };

type NavEntry = { key: string; label: string; href: string; icon: IconName; sub?: boolean };

// Kit's stations sit under Kit (indented in the expanded sidebar). Configuration goes below the divider.
const NAV: NavEntry[] = [
  { key: "dashboard", label: "Dashboard", href: "/admin", icon: "dashboard" },
  { key: "registrations", label: "Registrations", href: "/admin/registrations", icon: "registrations" },
  { key: "kit", label: "Kit", href: "/admin/kit", icon: "kit" },
  { key: "kit-desk", label: "Desk", href: "/admin/kit/desk", icon: "qr", sub: true },
  { key: "kit-picker", label: "Picker", href: "/admin/kit/picker", icon: "package", sub: true },
  { key: "kit-pick", label: "Pick", href: "/admin/kit/pick", icon: "box", sub: true },
  { key: "kit-handover", label: "Handover", href: "/admin/kit/handover", icon: "handover", sub: true },
  { key: "kit-counter", label: "Counter", href: "/admin/kit/counter", icon: "userCheck", sub: true },
  { key: "kit-exceptions", label: "Exceptions", href: "/admin/kit/exceptions", icon: "warning", sub: true },
  { key: "kit-labels", label: "Labels", href: "/admin/kit/labels", icon: "label", sub: true },
];
const BOTTOM_NAV: NavEntry[] = [{ key: "configuration", label: "Configuration", href: "/admin/assets", icon: "configuration" }];

/** The sidebar item for a path: the longest nav href that is the path or a parent of it. */
function activeKeyFor(pathname: string): string {
  let best: NavEntry | undefined;
  for (const item of [...NAV, ...BOTTOM_NAV]) {
    const match = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (match && (!best || item.href.length > best.href.length)) best = item;
  }
  return best?.key ?? "";
}

function toNavItems(entries: NavEntry[], collapsed: boolean): NavItemDef[] {
  return entries.map((e) => ({
    key: e.key,
    label: e.label,
    href: e.href,
    // Sub-pages are indented under Kit; the 54px rail has no room for indentation.
    icon: e.sub && !collapsed ? (
      <span className="flex pl-4">
        <Icon name={e.icon} size={18} />
      </span>
    ) : (
      <Icon name={e.icon} size={18} />
    ),
  }));
}

/**
 * /logo.png is a 300x202 landscape wordmark: show all of it, never crop. Expanded it is 36px tall
 * (about 53px wide); in the 54px rail it is capped at 36px wide so it fits the collapsed row.
 */
function logoFor(collapsed: boolean) {
  return (
    <Image
      src="/logo.png"
      alt="TGCG"
      width={300}
      height={202}
      className={`shrink-0 rounded-8 ${collapsed ? "h-auto w-9" : "h-9 w-auto"}`}
    />
  );
}

/**
 * Dock app frame for /admin: full-height Sidebar (255px, 54px rail when collapsed) and a 53px topbar
 * (event switcher on the left, account menu on the right) over a 16px-padded white content area.
 * Below md the sidebar becomes an overlay opened from the topbar's menu button.
 * Shell chrome is hidden in print so label sheets print on white without it.
 */
export default function AdminShell({
  email,
  events,
  selectedSlug,
  children,
}: {
  email: string;
  events: AdminEventOption[];
  selectedSlug: string | null;
  children: ReactNode;
}) {
  const nav = { top: NAV, bottom: BOTTOM_NAV };
  const brandName = "TGCG Admin";
  const pathname = usePathname();
  const activeKey = activeKeyFor(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const initial = (email.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="flex min-h-screen bg-white text-ink print:block print:bg-white">
      {/* Desktop / tablet: in-flow sidebar */}
      <div className="hidden shrink-0 md:block print:hidden">
        <Sidebar
          items={toNavItems(nav.top, collapsed)}
          bottomItems={toNavItems(nav.bottom, collapsed)}
          activeKey={activeKey}
          logo={logoFor(collapsed)}
          brandName={brandName}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* Phone: sidebar as an overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden print:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-alpha-64"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full shadow-dock-xl">
            <Sidebar
              items={toNavItems(nav.top, false)}
              bottomItems={toNavItems(nav.bottom, false)}
              activeKey={activeKey}
              onSelect={() => setMobileOpen(false)}
              logo={logoFor(false)}
              brandName={brandName}
              onToggleCollapse={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[53px] shrink-0 items-center gap-2 border-b border-line-secondary bg-white px-2 py-2 sm:px-4 print:hidden">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-8 text-dark hover:bg-surface-secondary md:hidden"
          >
            <Icon name="menu" size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <EventSwitcher events={events} selectedSlug={selectedSlug} />
          </div>
          <AccountMenu email={email} initial={initial} />
        </header>
        <main className="min-w-0 flex-1 p-4 print:p-0">
          <InstallPrompt
            appId="admin"
            appName="TGCG Admin"
            description="Open the dashboard as its own app, from your taskbar, dock or home screen."
            iconSrc="/app-icons/admin-192.png"
            className="mb-4 print:hidden"
          />
          {children}
        </main>
      </div>
    </div>
  );
}

function Avatar({ initial, size }: { initial: string; size: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-line-secondary bg-white text-12 text-ink"
      style={{ width: size, height: size }}
    >
      {initial}
    </span>
  );
}

/** Dock account menu: 24px avatar + name + chevron; opens a 322px panel with the user card and Sign out. */
function AccountMenu({ email, initial }: { email: string; initial: string }) {
  return (
    <Popover
      align="right"
      className="shrink-0"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-label="Account menu"
          aria-expanded={open}
          onClick={toggle}
          className={`flex h-9 items-center gap-2 rounded-8 px-2 ${open ? "bg-surface-secondary" : "hover:bg-surface-secondary"}`}
        >
          <Avatar initial={initial} size={24} />
          <span className="hidden max-w-[240px] truncate text-14 font-medium text-ink sm:inline">{email}</span>
          <Icon name={open ? "chevronUp" : "chevronDown"} size={14} className="text-ink" />
        </button>
      )}
    >
      {() => (
        <div className="w-[min(322px,calc(100vw-16px))] p-1.5">
          <div className="flex items-center gap-1.5 rounded-4 bg-surface-tertiary px-3 py-1.5">
            <Avatar initial={initial} size={32} />
            <div className="ml-1.5 min-w-0">
              <p className="text-12 text-ink-tertiary">Signed in as</p>
              <p className="truncate text-14 font-medium text-ink">{email}</p>
            </div>
          </div>
          <div className="my-1.5 h-px bg-line-secondary" />
          <SignOutButton variant="menu" />
        </div>
      )}
    </Popover>
  );
}
