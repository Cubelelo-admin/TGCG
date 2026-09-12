"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { NAV_LINKS } from "@/lib/site-content";
import { PrimaryButton } from "./Buttons";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#17181a]/10 bg-[#f6ede1]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <Image src="/logo.png" alt="LetsRun" width={40} height={40} className="h-9 w-9" />
          <span className="text-sm font-bold tracking-[0.05em]">LETSRUN</span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[#17181a]/80 transition hover:text-[#b9541f]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
          <PrimaryButton href="/register" size="md">
            Register Now
          </PrimaryButton>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#17181a]/15 lg:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M18 6l-12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-[#17181a]/10 px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[#17181a]/80"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <PrimaryButton href="/register" size="md" className="mt-2 w-full">
              Register Now
            </PrimaryButton>
          </nav>
        </div>
      )}
    </header>
  );
}
