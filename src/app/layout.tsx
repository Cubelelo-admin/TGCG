import type { Metadata } from "next";
import { Archivo_Black, Work_Sans } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LetsRun TGCG 2026 — The Great Chhattisgarh Run",
  description:
    "LetsRun TGCG 2026 — 20 December 2026, CBD Square, Naya Raipur. Register for the marathon, half marathon, 10K and dream run.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${workSans.variable} ${archivoBlack.variable} antialiased`}
    >
      {/*
        No h-full/min-h-full here (and none on <body>) — deliberately. Those
        resolve to a percentage of the viewport, and /register is embedded
        in an auto-resizing iframe (see IframeAutoResize.tsx): once its own
        JS sets the iframe taller to fit content, 100vh — and any %-height
        chain rooted at it — grows too, so the page can never measure back
        down to a shorter scrollHeight after content collapses (e.g. Save
        collapsing the attendee form to the "So Far" recap). Each route
        group that wants a full-viewport-height page (site/admin, never
        iframe-embedded) sets that itself with an explicit min-h-screen
        instead — see (site)/layout.tsx and admin's own layouts.
      */}
      <body className="bg-[#f6ede1] text-[#17181a]">{children}</body>
    </html>
  );
}
