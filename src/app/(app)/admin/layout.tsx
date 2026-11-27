import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import { BrandProvider } from "@/components/ds";
import "./admin-theme.css";

// The Cubelelo design system's only font, self-hosted by next/font at build time
// (no render-blocking request to Google Fonts).
const lexend = Lexend({ weight: ["400", "500", "600"], subsets: ["latin", "latin-ext"], variable: "--font-ds-body" });

// Installable as its own desktop app (see InstallPrompt). The manifest lives outside /admin:
// browsers fetch it without cookies, and the middleware sends cookie-less /admin requests to login.
export const metadata: Metadata = {
  title: "TGCG Admin",
  manifest: "/manifests/admin.webmanifest",
  appleWebApp: { capable: true, title: "TGCG Admin", statusBarStyle: "default" },
  icons: { apple: "/app-icons/admin-apple-180.png" },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  // .ds scopes the admin: Lexend, Dock body text (14/18, ink). BrandProvider sets --accent
  // (Cubelelo orange), which only focus rings and brand touches read.
  return (
    <div className={`ds ${lexend.variable} font-[family-name:var(--font-ds-body),system-ui,sans-serif] text-14 text-ink`}>
      <BrandProvider brand="cubelelo">{children}</BrandProvider>
    </div>
  );
}
