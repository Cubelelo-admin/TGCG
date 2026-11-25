import type { ReactNode } from "react";
import { Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import "./admin-theme.css";

// Self-hosted by next/font at build time: no render-blocking request to Google Fonts.
const display = Barlow_Condensed({ weight: ["600", "700"], subsets: ["latin"], variable: "--font-ds-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-ds-body" });
const mono = JetBrains_Mono({ weight: "500", subsets: ["latin"], variable: "--font-ds-mono" });

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className={`ds ${display.variable} ${body.variable} ${mono.variable}`}>{children}</div>;
}
