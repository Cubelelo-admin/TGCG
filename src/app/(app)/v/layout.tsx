import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import { BrandProvider } from "@/components/ds";
import "../admin/admin-theme.css";

const lexend = Lexend({ weight: ["400", "500", "600"], subsets: ["latin", "latin-ext"], variable: "--font-ds-body" });

// The volunteer app: one URL for every volunteer, the role decides the screen. Installable to
// the home screen (manifest outside /v for the same reason as the admin one: browsers fetch
// it without cookies).
export const metadata: Metadata = {
  title: "TGCG Volunteers",
  manifest: "/manifests/volunteer.webmanifest",
  appleWebApp: { capable: true, title: "TGCG Crew", statusBarStyle: "black" },
  icons: { apple: "/app-icons/volunteer-apple-180.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d121c",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function VolunteerRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`ds ${lexend.variable} font-[family-name:var(--font-ds-body),system-ui,sans-serif] text-14 text-ink`}>
      <BrandProvider brand="cubelelo">{children}</BrandProvider>
    </div>
  );
}
