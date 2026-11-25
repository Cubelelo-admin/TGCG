import type { ReactNode } from "react";
import { Lexend } from "next/font/google";
import { BrandProvider } from "@/components/ds";
import "./admin-theme.css";

// The Cubelelo design system's only font, self-hosted by next/font at build time
// (no render-blocking request to Google Fonts).
const lexend = Lexend({ weight: ["400", "500", "600"], subsets: ["latin", "latin-ext"], variable: "--font-ds-body" });

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  // .ds scopes the admin: Lexend, Dock body text (14/18, ink). BrandProvider sets --accent
  // (Cubelelo orange), which only focus rings and brand touches read.
  return (
    <div className={`ds ${lexend.variable} font-[family-name:var(--font-ds-body),system-ui,sans-serif] text-14 text-ink`}>
      <BrandProvider brand="cubelelo">{children}</BrandProvider>
    </div>
  );
}
