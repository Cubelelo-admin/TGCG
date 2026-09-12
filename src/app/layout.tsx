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
    "LetsRun TGCG 2026 — 20 December 2026, Ekatma Path Park, Raipur. Register for the marathon, half marathon, 10K and dream run.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${workSans.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f6ede1] text-[#17181a]">
        {children}
      </body>
    </html>
  );
}
