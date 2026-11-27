import Footer from "@/site/components/Footer";
import Header from "@/site/components/Header";
import RevealObserver from "@/site/components/RevealObserver";
import StickyActions from "@/site/components/StickyActions";
import type { EventConfig } from "@/site/content/types";
import { inr, minFee, registrationStatus, waLink } from "@/site/lib/event";

// Wraps an event section with its own header, footer and colour theme (see [data-event] in globals.css).
export default function EventShell({ e, children }: { e: EventConfig; children: React.ReactNode }) {
  const fee = minFee(e);
  const status = registrationStatus(e);
  const headerCta =
    status === "open"
      ? { label: "Register", href: `${e.basePath}/register` }
      : status === "closed"
        ? { label: "Race day guide", href: `${e.basePath}/race-day` }
        : { label: "Get notified", href: `${e.basePath}/register` };

  return (
    <div className="event-shell" data-event={e.slug}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header basePath={e.basePath} brand="TGCG" city={e.city} nav={e.nav} registerLabel={headerCta.label} registerHref={headerCta.href} />
      <main id="main">{children}</main>
      <Footer e={e} />
      <StickyActions
        basePath={e.basePath}
        whatsappHref={waLink(e, `Hi, I have a question about ${e.shortName} ${e.edition}.`)}
        notifyHref={waLink(e, `Hi, please notify me when registration for ${e.shortName} ${e.edition} opens.`)}
        priceLabel={fee !== null ? `From ${inr(fee)}${e.fees.find((f) => f.price === fee)?.tax ? ` ${e.fees.find((f) => f.price === fee)!.tax}` : ""}` : undefined}
        dateLabel={e.dateLabel.replace(/^\w+, /, "")}
        status={status}
      />
      <RevealObserver />
    </div>
  );
}
