import Link from "next/link";
import { CONTACT, LEGAL, NAV_LINKS, SOCIAL_LINKS } from "@/lib/site-content";

export default function Footer() {
  return (
    <footer className="border-t border-[#17181a]/10 bg-[#17181a] text-[#f6ede1]">
      <div className="mx-auto max-w-6xl px-6 py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="text-sm font-bold tracking-[0.05em]">LETSRUN</span>
          <p className="mt-3 text-sm text-[#f6ede1]/60 leading-relaxed">
            The Great Chhattisgarh Run — running for cleaner, greener rivers.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#f6ede1]/50">
            Explore
          </h3>
          <ul className="mt-4 space-y-2.5">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-[#f6ede1]/80 hover:text-[#e8b98f]">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/register" className="text-sm text-[#f6ede1]/80 hover:text-[#e8b98f]">
                Registration
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#f6ede1]/50">
            Contact
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-[#f6ede1]/80">
            <li>
              <a href={`mailto:${CONTACT.email}`} className="hover:text-[#e8b98f]">
                {CONTACT.email}
              </a>
            </li>
            <li>
              <a href={CONTACT.whatsappHref} className="hover:text-[#e8b98f]">
                WhatsApp {CONTACT.whatsappDisplay}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#f6ede1]/50">
            Follow
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-[#f6ede1]/80">
            <li>
              <a href={SOCIAL_LINKS.instagramTgcg} className="hover:text-[#e8b98f]">
                Instagram — @tgcg.run
              </a>
            </li>
            <li>
              <a href={SOCIAL_LINKS.instagramLetsRun} className="hover:text-[#e8b98f]">
                Instagram — @letsrun.us
              </a>
            </li>
            <li>
              <a href={SOCIAL_LINKS.facebook} className="hover:text-[#e8b98f]">
                Facebook
              </a>
            </li>
            <li>
              <a href={SOCIAL_LINKS.youtube} className="hover:text-[#e8b98f]">
                YouTube
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#f6ede1]/10">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-[#f6ede1]/50">
          {LEGAL.entityLine} · {LEGAL.formalName} · CIN {LEGAL.cin}
        </div>
      </div>
    </footer>
  );
}
