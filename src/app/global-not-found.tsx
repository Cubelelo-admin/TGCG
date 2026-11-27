import type { Metadata } from "next";
import { Archivo, Inter, Noto_Sans_Devanagari } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import Bi from "@/site/components/Bi";
import { events } from "@/site/content/events";
import { organiser } from "@/site/content/organiser";
import "./(public)/globals.css";

// Global 404 for URLs that match no route. The app has two root layouts (public site and
// registration/admin), so this page brings its own <html>, fonts and styles.
const display = Archivo({ subsets: ["latin"], variable: "--font-display", axes: ["wdth"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const hindi = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "600"], variable: "--font-hindi" });

export const metadata: Metadata = { title: "Page not found | TGCG.run" };

// Branded 404: same look as the event chooser, with a way back to each event.
export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${hindi.variable}`}>
      <body>
        <div className="chooser">
          <main>
            <header className="chooser-head container">
              <Image src="/shared/letsrun-logo.png" alt="LetsRun" width={72} height={72} className="chooser-logo" priority />
              <p className="eyebrow">404 · Off course</p>
              <h1>
                This page took a wrong turn
                <span className="hi chooser-h1-hi">यह पेज नहीं मिला</span>
              </h1>
              <p className="lead">
                The link may be old or mistyped. Pick your event to get back on the route.
                <span className="hi">अपनी दौड़ चुनें और सही रास्ते पर लौटें।</span>
              </p>
              <div className="hero-actions" style={{ justifyContent: "center" }}>
                {events.map((e) => (
                  <Link key={e.slug} href={e.basePath} className="btn btn-primary" data-event={e.slug}>
                    <Bi en={e.shortName} hi={e.cityHi} />
                  </Link>
                ))}
                <Link href="/" className="btn btn-ghost">
                  All events
                </Link>
              </div>
            </header>
          </main>
          <footer className="chooser-foot container">
            <Bi en={`Organised by ${organiser.name}`} hi="आयोजक: लेट्सरन टीम" /> ·{" "}
            <a href={organiser.whatsappUrl}>WhatsApp {organiser.whatsappNumber}</a> ·{" "}
            <a href={`mailto:${organiser.email}`}>{organiser.email}</a>
          </footer>
        </div>
      </body>
    </html>
  );
}
