import type { ReactNode } from "react";
import { Lexend } from "next/font/google";
import "./admin-theme.css";

// The Cubelelo design system's only font, self-hosted by next/font at build time
// (no render-blocking request to Google Fonts).
const lexend = Lexend({ weight: ["400", "500", "600"], subsets: ["latin", "latin-ext"], variable: "--font-ds-body" });

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className={`ds ${lexend.variable}`}>{children}</div>;
}
