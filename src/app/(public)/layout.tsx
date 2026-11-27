import type { Metadata, Viewport } from "next";
import { Archivo, Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const display = Archivo({ subsets: ["latin"], variable: "--font-display", axes: ["wdth"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const hindi = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "600"], variable: "--font-hindi" });

// Re-render pages at most hourly so date-driven state (registration open → closed, race over)
// updates on its own without a redeploy.
export const revalidate = 3600;

export const metadata: Metadata = {
  metadataBase: new URL("https://tgcg.run"),
  title: {
    default: "TGCG.run | The Great Chhattisgarh Run",
    template: "%s | TGCG.run",
  },
  description: "The Great Chhattisgarh Run events by LetsRun: TGCG Raipur and TGCG Raigarh. Choose your run and register.",
  openGraph: { type: "website", siteName: "TGCG.run" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/shared/letsrun-logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#093556",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the mobile bar sit above the iPhone home indicator (safe-area insets)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${hindi.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
