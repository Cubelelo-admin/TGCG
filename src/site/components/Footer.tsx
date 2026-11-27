import Image from "next/image";
import Link from "next/link";
import { organiser } from "@/site/content/organiser";
import type { EventConfig } from "@/site/content/types";
import { waLink } from "@/site/lib/event";

export default function Footer({ e }: { e: EventConfig }) {
  return (
    <footer className="site-footer">
      <div className="waves" aria-hidden="true" />
      <div className="container footer-grid">
        <div>
          <Image src="/shared/letsrun-logo.png" alt="LetsRun" width={84} height={84} className="footer-logo" />
          <p className="muted">
            {e.name} {e.edition} is organised by {organiser.name}, {organiser.address}.
            <br />
            {organiser.legalName} · CIN: {organiser.cin}
          </p>
          {e.instagram && (
            <a href={e.instagram.url} target="_blank" rel="noopener noreferrer" className="footer-ig">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              {e.instagram.handle}
            </a>
          )}
        </div>

        <div>
          <h4>{e.shortName}</h4>
          <ul className="footer-links footer-links-cols">
            <li>
              <Link href={e.basePath}>Home</Link>
            </li>
            {e.nav.map((n) => (
              <li key={n.href}>
                <Link href={`${e.basePath}${n.href}`}>{n.label}</Link>
              </li>
            ))}
            <li>
              <Link href={`${e.basePath}/register`}>Register</Link>
            </li>
          </ul>
        </div>

        <div>
          <h4>Contact</h4>
          <ul className="footer-links">
            <li>
              <a href={waLink(e, `Hi, I have a question about ${e.shortName}.`)} target="_blank" rel="noopener noreferrer">
                WhatsApp helpline: {e.contact.whatsappNumber}
              </a>
            </li>
            <li>
              <a href={`mailto:${e.contact.email}`}>{e.contact.email}</a>
            </li>
            {e.socials.map((s) => (
              <li key={s.name}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.name} · {s.handle}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        © {new Date().getFullYear()} {organiser.name}
        {e.cause ? ` · ${e.cause}` : ""}
        {e.links.policies && (
          <span className="footer-policies">
            <Link href={`${e.links.policies}#terms`}>Terms</Link>
            <Link href={`${e.links.policies}#privacy`}>Privacy</Link>
            <Link href={`${e.links.policies}#refunds`}>Refunds</Link>
            <Link href={`${e.links.policies}#payments`}>Payments</Link>
          </span>
        )}
      </div>
    </footer>
  );
}
