"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavItem } from "@/site/content/types";

export default function Header({
  basePath,
  brand,
  city,
  nav,
  registerLabel = "Register",
  registerHref,
}: {
  basePath: string;
  brand: string;
  city: string;
  nav: NavItem[];
  registerLabel?: string;
  registerHref?: string;
}) {
  const ctaHref = registerHref ?? `${basePath}/register`;
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const moreRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const primary = nav.filter((n) => !n.more);
  const more = nav.filter((n) => n.more);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = more.some((n) => isActive(`${basePath}${n.href}`));

  // Close menus on navigation
  useEffect(() => {
    setOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  // Lock page scroll while the mobile menu is open; Escape closes it
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // "More" dropdown: close on outside click / Escape
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (ev: MouseEvent) => {
      if (!moreRef.current?.contains(ev.target as Node)) setMoreOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setMoreOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const link = (item: NavItem, cls = "") => {
    const href = `${basePath}${item.href}`;
    return (
      <Link key={href} href={href} className={`${cls} ${isActive(href) ? "active" : ""}`} aria-current={isActive(href) ? "page" : undefined}>
        {item.label}
      </Link>
    );
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="header-left">
          <Link href="/" className="home-btn" aria-label="All events (main page) / सभी इवेंट" title="All events / सभी इवेंट">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
            </svg>
          </Link>
          <Link href={basePath} className="brand" aria-label={`${brand} ${city} home`}>
            <span className="brand-mark">{brand}</span>
            <span className="brand-city">{city}</span>
          </Link>
        </div>

        {/* Desktop */}
        <nav className="main-nav" aria-label="Main">
          {primary.map((item) => link(item))}
          {more.length > 0 && (
            <div className="nav-more" ref={moreRef}>
              <button
                type="button"
                className={`nav-more-btn ${moreActive ? "active" : ""}`}
                aria-expanded={moreOpen}
                aria-haspopup="true"
                onClick={() => setMoreOpen((o) => !o)}
              >
                More <span aria-hidden="true">▾</span>
              </button>
              <div className={`nav-more-menu ${moreOpen ? "is-open" : ""}`}>{more.map((item) => link(item))}</div>
            </div>
          )}
        </nav>

        <div className="header-actions">
          <Link href={ctaHref} className="btn btn-primary nav-cta">
            {registerLabel}
          </Link>
          <button
            ref={toggleRef}
            className={`menu-toggle ${open ? "is-open" : ""}`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* Mobile */}
      <div className={`mobile-backdrop ${open ? "is-open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <nav id="mobile-menu" className={`mobile-nav ${open ? "is-open" : ""}`} aria-label="Mobile" inert={!open}>
        {nav.map((item) => link(item))}
        <Link href="/" className="mobile-home-link">
          ← All events · <span lang="hi">सभी इवेंट</span>
        </Link>
        <div className="mobile-nav-foot">
          <Link href={ctaHref} className="btn btn-primary">
            {registerLabel}
          </Link>
        </div>
      </nav>
    </header>
  );
}
