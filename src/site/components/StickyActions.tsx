"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0 0 12.04 2Zm5.8 14.13c-.24.68-1.42 1.32-1.96 1.37-.5.05-.98.23-3.3-.69-2.79-1.1-4.56-3.95-4.7-4.13-.14-.18-1.12-1.49-1.12-2.85s.71-2.02.97-2.3c.25-.28.55-.35.73-.35l.53.01c.17.01.4-.06.62.48.24.56.8 1.94.87 2.08.07.14.12.3.02.48-.09.18-.14.3-.28.46-.14.16-.29.36-.42.48-.14.14-.28.29-.12.57.16.28.72 1.19 1.55 1.92 1.07.95 1.97 1.24 2.25 1.38.28.14.44.12.6-.07.16-.19.7-.81.88-1.09.18-.28.37-.23.62-.14.25.09 1.6.76 1.88.89.28.14.46.21.53.32.07.12.07.66-.17 1.34Z" />
  </svg>
);

// Floating WhatsApp button (desktop) and a sticky register bar (phones).
export default function StickyActions({
  basePath,
  whatsappHref,
  priceLabel,
  dateLabel,
  status,
  notifyHref,
}: {
  basePath: string;
  whatsappHref: string;
  priceLabel?: string;
  dateLabel: string;
  status: "soon" | "open" | "closed";
  notifyHref: string;
}) {
  const pathname = usePathname();
  const onRegister = pathname.startsWith(`${basePath}/register`);
  const subLabel = status === "closed" ? "Registration closed" : priceLabel ? dateLabel : "Registration opening soon";

  return (
    <>
      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="wa-fab" aria-label="Chat with us on WhatsApp">
        <WhatsAppIcon />
        <span className="wa-fab-label">Need help?</span>
      </a>

      {!onRegister && (
        <div className="mobile-bar" role="region" aria-label="Quick actions">
          <div className="mobile-bar-info">
            <strong>{status === "closed" ? dateLabel : (priceLabel ?? dateLabel)}</strong>
            <span>{subLabel}</span>
          </div>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="mobile-bar-wa" aria-label="WhatsApp helpline">
            <WhatsAppIcon />
          </a>
          {status === "open" ? (
            <Link href={`${basePath}/register`} className="btn btn-primary">
              Register
            </Link>
          ) : status === "closed" ? (
            <Link href={`${basePath}/race-day`} className="btn btn-primary">
              Race day
            </Link>
          ) : (
            <a href={notifyHref} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Notify me
            </a>
          )}
        </div>
      )}
    </>
  );
}
